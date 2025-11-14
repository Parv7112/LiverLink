import { motion } from "framer-motion";
import { Activity, CheckCircle, Clock, Heart, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchAgentHistory } from "../lib/api";

type Patient = {
  id?: string;
  patient_id?: string;
  name?: string;
  blood_type?: string;
  age?: number;
  meld?: number;
  waitlist_days?: number;
  transport_eta_min?: number;
  eta_min?: number;
  survival_6hr_prob?: number;
  predicted_1yr_survival?: number;
  allocation_score?: number;
  or_available?: boolean;
  hla_match?: number;
};

type AllocationEntry = {
  _id?: string;
  timestamp?: string;
  donor?: {
    qr_code_id?: string;
    organ?: string;
    blood_type?: string;
    age?: number;
    procurement_hospital?: string;
    hla_a?: string;
    hla_b?: string;
    hla_drb1?: string;
  };
  ranked_patients?: Patient[];
  accepted_patient?: Patient;
  timeline?: Array<{ event: string; timestamp: string }>;
};

function AgentLog() {
  const [history, setHistory] = useState<AllocationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const { token, openLogin } = useAuth();
  const pollerRef = useRef<number | null>(null);

  const loadHistory = async (showSpinner = false) => {
    if (!token) {
      setHistory([]);
      return;
    }
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const response = await fetchAgentHistory();
      setHistory(response.history ?? []);
    } catch (error) {
      console.error("Unable to load agent history", error);
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!token) {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }

    loadHistory(true);
    setAutoUpdating(true);
    pollerRef.current = window.setInterval(() => {
      loadHistory(false);
    }, 4000);

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      setAutoUpdating(false);
    };
  }, [token]);

  useEffect(() => {
    if (history.length > 0 && pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
      setAutoUpdating(false);
    }
  }, [history]);

  const refresh = async () => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
    await loadHistory(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Agent Memory</p>
          <h1 className="text-3xl font-bold text-slate-100">Allocation History</h1>
          <p className="text-sm text-slate-500">
            Autonomous organ allocation decisions {autoUpdating && "• Listening for new runs…"}
          </p>
        </div>
        {token && (
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-medical-blue hover:text-medical-blue disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        )}
      </header>

      <div className="space-y-6">
        {!token && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400">
            <p className="font-semibold text-slate-100">Login required</p>
            <p className="text-xs text-slate-500">
              Agent memory contains protected PHI. Please authenticate first to view allocation history.
            </p>
            <button
              onClick={() => openLogin("Log in to view historical allocations.")}
              className="mt-4 rounded-full bg-medical-blue px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
            >
              Admin Login
            </button>
          </div>
        )}

        {!loading && token && history.length === 0 && (
          <p className="text-center text-sm text-slate-500">No allocations logged yet. Listening for new runs…</p>
        )}

        {history.map((entry, index) => (
          <motion.div
            key={entry._id || index}
            className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {/* Header */}
            <div className="mb-6 flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "Unknown time"}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-100">
                  {entry.donor?.organ?.toUpperCase() || "ORGAN"} Allocation
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Donor: {entry.donor?.qr_code_id || "Unknown"} • {entry.donor?.blood_type || "?"} • Age {entry.donor?.age || "?"}
                </p>
              </div>
              {entry.accepted_patient && (
                <div className="flex items-center gap-2 rounded-full bg-medical-green/20 px-4 py-2 text-medical-green">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Allocated</span>
                </div>
              )}
            </div>

            {/* Accepted Patient */}
            {entry.accepted_patient && (
              <div className="mb-6 rounded-2xl border border-medical-green/40 bg-medical-green/10 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-medical-green">
                  ✓ Organ Allocated To
                </p>
                <PatientCard patient={entry.accepted_patient} isAccepted />
              </div>
            )}

            {/* Ranked Patients */}
            {entry.ranked_patients && entry.ranked_patients.length > 0 && (
              <div>
                <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-500">
                  Ranked Candidates ({entry.ranked_patients.length})
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {entry.ranked_patients.map((patient, idx) => (
                    <PatientCard key={patient.id || patient.patient_id || idx} patient={patient} rank={idx + 1} />
                  ))}
                </div>
              </div>
            )}

            {!entry.ranked_patients?.length && !entry.accepted_patient && (
              <p className="text-center text-sm text-slate-500">No candidates were ranked</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PatientCard({ patient, rank, isAccepted }: { patient: Patient; rank?: number; isAccepted?: boolean }) {
  const survival = Math.round((patient.survival_6hr_prob ?? 0) * 100);
  const isCritical = survival < 60;

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        isAccepted
          ? "border-medical-green/60 bg-medical-green/5"
          : isCritical
          ? "border-medical-red/40 bg-slate-900/60"
          : "border-slate-700 bg-slate-900/60"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {rank && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-medical-blue/20 text-xs font-bold text-medical-blue">
                {rank}
              </span>
            )}
            <p className="font-semibold text-slate-100">{patient.name || "Unknown"}</p>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {patient.blood_type || "?"} • {patient.age || "?"} years
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isCritical ? "bg-medical-red/20 text-medical-red" : "bg-medical-green/20 text-medical-green"
          }`}
        >
          {survival}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Activity className="h-3.5 w-3.5 text-medical-blue" />
          <span>MELD {patient.meld ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span>{patient.waitlist_days ?? "—"}d wait</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-slate-500" />
          <span>{patient.transport_eta_min ?? patient.eta_min ?? "—"}m ETA</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Heart className="h-3.5 w-3.5 text-medical-red" />
          <span>HLA {patient.hla_match ?? "—"}%</span>
        </div>
      </div>

      {patient.allocation_score !== undefined && (
        <div className="mt-3 rounded-lg bg-slate-800/60 px-3 py-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Allocation Score</p>
          <p className="text-lg font-bold text-medical-blue">{patient.allocation_score.toFixed(3)}</p>
        </div>
      )}

      {patient.or_available !== undefined && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <div className={`h-2 w-2 rounded-full ${patient.or_available ? "bg-medical-green" : "bg-slate-600"}`} />
          <span>OR {patient.or_available ? "Ready" : "Not Ready"}</span>
        </div>
      )}
    </div>
  );
}

export default AgentLog;
