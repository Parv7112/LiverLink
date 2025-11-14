import { motion, AnimatePresence } from "framer-motion";
import { Activity, CheckCircle, Clock, Heart, MapPin, Phone, CheckSquare, X, Info } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchAgentHistory, contactPatient, acceptAllocation } from "../lib/api";

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
  // Scoring components
  urgency_score?: number;
  survival_score?: number;
  ai_compatibility_score?: number;
  immuno_score?: number;
  distance_score?: number;
  readiness_score?: number;
  risk_adjustment?: number;
  // AI fields
  ai_reasoning?: string;
  ai_survival_6hr?: number;
  heuristic_survival_6hr?: number;
  // Additional fields
  distance_to_donor_km?: number;
  icu_bed_available?: boolean;
  hepatocellular_carcinoma?: boolean;
  diabetes?: boolean;
  renal_failure?: boolean;
  ventilator_dependent?: boolean;
  hla_antibody_level?: number;
  hospital?: string;
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
  accepted_manually?: boolean;
  timeline?: Array<{ event: string; timestamp: string }>;
};

function AgentLog() {
  const [history, setHistory] = useState<AllocationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [contactingPatient, setContactingPatient] = useState<string | null>(null);
  const [acceptingPatient, setAcceptingPatient] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
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

  const handleContactPatient = useCallback(
    async (patientId: string, donorQrCode: string, patientName: string) => {
      setContactingPatient(patientId);
      try {
        const message = `URGENT: Liver available for ${patientName}. Please respond ASAP to confirm acceptance.`;
        await contactPatient(donorQrCode, patientId, message);
        alert(`SMS sent to surgeon for ${patientName}`);
      } catch (error: any) {
        console.error("Failed to contact patient:", error);
        alert(`Failed to send SMS: ${error.response?.data?.detail || error.message}`);
      } finally {
        setContactingPatient(null);
      }
    },
    []
  );

  const handleAcceptAllocation = useCallback(
    async (patientId: string, donorQrCode: string, allocationId: string, patientName: string) => {
      if (!confirm(`Confirm allocation to ${patientName}?`)) {
        return;
      }
      setAcceptingPatient(patientId);
      try {
        await acceptAllocation(donorQrCode, patientId, allocationId);
        alert(`Organ successfully allocated to ${patientName}!`);
        await loadHistory(false); // Refresh to show updated status
      } catch (error: any) {
        console.error("Failed to accept allocation:", error);
        alert(`Failed to accept allocation: ${error.response?.data?.detail || error.message}`);
      } finally {
        setAcceptingPatient(null);
      }
    },
    [loadHistory]
  );

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
                    <PatientCard
                      key={patient.id || patient.patient_id || idx}
                      patient={patient}
                      rank={idx + 1}
                      allocationId={entry._id}
                      donorQrCode={entry.donor?.qr_code_id}
                      isAllocated={!!entry.accepted_patient}
                      onContact={handleContactPatient}
                      onAccept={handleAcceptAllocation}
                      onViewDetails={() => setSelectedPatient(patient)}
                      isContacting={contactingPatient === (patient.patient_id || patient.id)}
                      isAccepting={acceptingPatient === (patient.patient_id || patient.id)}
                    />
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

      {/* Patient Details Modal */}
      <AnimatePresence>
        {selectedPatient && (
          <PatientDetailsModal patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PatientDetailsModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const survival = Math.round((patient.survival_6hr_prob ?? 0) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6 border-b border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-slate-100">{patient.name || "Unknown Patient"}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {patient.blood_type || "?"} • {patient.age || "?"} years • Patient ID: {patient.patient_id || patient.id}
          </p>
        </div>

        {/* Survival & Score */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">6-Hour Survival</p>
            <p className={`text-3xl font-bold ${survival < 60 ? "text-medical-red" : "text-medical-green"}`}>
              {survival}%
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">Allocation Score</p>
            <p className="text-3xl font-bold text-medical-blue">
              {patient.allocation_score ? (patient.allocation_score * 100).toFixed(1) : "—"}
            </p>
          </div>
        </div>

        {/* Clinical Details */}
        <div className="mb-6 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Clinical Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-medical-blue" />
              <span className="text-slate-400">MELD:</span>
              <span className="font-semibold text-slate-200">{patient.meld ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="text-slate-400">Waitlist:</span>
              <span className="font-semibold text-slate-200">{patient.waitlist_days ?? "—"} days</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-medical-red" />
              <span className="text-slate-400">HLA Match:</span>
              <span className="font-semibold text-slate-200">{patient.hla_match ?? "—"}%</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              <span className="text-slate-400">Distance:</span>
              <span className="font-semibold text-slate-200">
                {patient.distance_to_donor_km ? `${Math.round(patient.distance_to_donor_km)}km` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Hospital Readiness */}
        {(patient.hospital || patient.or_available !== undefined || patient.icu_bed_available !== undefined) && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Hospital Readiness</h3>
            <div className="flex flex-wrap gap-2">
              {patient.hospital && (
                <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">{patient.hospital}</span>
              )}
              {patient.or_available !== undefined && (
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    patient.or_available ? "bg-medical-green/20 text-medical-green" : "bg-slate-700 text-slate-400"
                  }`}
                >
                  OR {patient.or_available ? "✓" : "✗"}
                </span>
              )}
              {patient.icu_bed_available !== undefined && (
                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    patient.icu_bed_available ? "bg-medical-green/20 text-medical-green" : "bg-slate-700 text-slate-400"
                  }`}
                >
                  ICU {patient.icu_bed_available ? "✓" : "✗"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Risk Factors */}
        {(!!patient.hepatocellular_carcinoma ||
          !!patient.diabetes ||
          !!patient.renal_failure ||
          !!patient.ventilator_dependent) && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Risk Factors</h3>
            <div className="flex flex-wrap gap-2">
              {patient.hepatocellular_carcinoma && (
                <span className="rounded-full bg-medical-red/20 px-3 py-1 text-sm text-medical-red">
                  Hepatocellular Carcinoma
                </span>
              )}
              {patient.diabetes && (
                <span className="rounded-full bg-orange-500/20 px-3 py-1 text-sm text-orange-400">Diabetes</span>
              )}
              {patient.renal_failure && (
                <span className="rounded-full bg-orange-500/20 px-3 py-1 text-sm text-orange-400">Renal Failure</span>
              )}
              {patient.ventilator_dependent && (
                <span className="rounded-full bg-medical-red/20 px-3 py-1 text-sm text-medical-red">
                  Ventilator Dependent
                </span>
              )}
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        {patient.allocation_score !== undefined && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Score Breakdown</h3>
            <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-800/40 p-4">
              {patient.urgency_score !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Urgency (25%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {(patient.urgency_score * 100).toFixed(1)}
                  </span>
                </div>
              )}
              {patient.survival_score !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Survival (20%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {(patient.survival_score * 100).toFixed(1)}
                  </span>
                </div>
              )}
              {patient.ai_compatibility_score !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-medical-blue">🤖 AI Compatibility (20%)</span>
                  <span className="font-mono font-semibold text-medical-blue">
                    {(patient.ai_compatibility_score * 100).toFixed(1)}
                  </span>
                </div>
              )}
              {patient.immuno_score !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Immunological (12%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {(patient.immuno_score * 100).toFixed(1)}
                  </span>
                </div>
              )}
              {patient.distance_score !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Distance (10%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {(patient.distance_score * 100).toFixed(1)}
                  </span>
                </div>
              )}
              {patient.readiness_score !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Readiness (8%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {(patient.readiness_score * 100).toFixed(1)}
                  </span>
                </div>
              )}
              {patient.risk_adjustment !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Risk Adjustment (5%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {(patient.risk_adjustment * 100).toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {patient.ai_reasoning && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              🤖 AI Clinical Analysis & Prognosis
            </h3>
            <div className="rounded-2xl border border-medical-blue/30 bg-medical-blue/10 p-4 text-sm leading-relaxed text-slate-300">
              {(() => {
                const reasoning = patient.ai_reasoning || '';
                return reasoning.split(/(?:IMMEDIATE:|SHORT-TERM:|LONG-TERM:|RECOMMENDATION:)/i).map((section, idx) => {
                  const trimmed = section.trim();
                  if (!trimmed) return null;
                  
                  let sectionType = '';
                  if (reasoning.includes(`IMMEDIATE: ${trimmed}`) || reasoning.includes(`IMMEDIATE:${trimmed}`)) {
                    sectionType = 'IMMEDIATE';
                  } else if (reasoning.includes(`SHORT-TERM: ${trimmed}`) || reasoning.includes(`SHORT-TERM:${trimmed}`)) {
                    sectionType = 'SHORT-TERM';
                  } else if (reasoning.includes(`LONG-TERM: ${trimmed}`) || reasoning.includes(`LONG-TERM:${trimmed}`)) {
                    sectionType = 'LONG-TERM';
                  } else if (reasoning.includes(`RECOMMENDATION: ${trimmed}`) || reasoning.includes(`RECOMMENDATION:${trimmed}`)) {
                    sectionType = 'RECOMMENDATION';
                  }
                  
                  return (
                    <div key={idx} className="mb-3 last:mb-0">
                      {sectionType && (
                        <span className="font-semibold text-medical-blue uppercase tracking-wide text-xs">
                          {sectionType}:{' '}
                        </span>
                      )}
                      <span>{trimmed}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function PatientCard({
  patient,
  rank,
  isAccepted,
  allocationId,
  donorQrCode,
  isAllocated,
  onContact,
  onAccept,
  onViewDetails,
  isContacting,
  isAccepting,
}: {
  patient: Patient;
  rank?: number;
  isAccepted?: boolean;
  allocationId?: string;
  donorQrCode?: string;
  isAllocated?: boolean;
  onContact?: (patientId: string, donorQrCode: string, patientName: string) => void;
  onAccept?: (patientId: string, donorQrCode: string, allocationId: string, patientName: string) => void;
  onViewDetails?: () => void;
  isContacting?: boolean;
  isAccepting?: boolean;
}) {
  const survival = Math.round((patient.survival_6hr_prob ?? 0) * 100);
  const isCritical = survival < 60;
  const patientId = patient.patient_id || patient.id || "";
  const patientName = patient.name || "Unknown";

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
          <span>
            {patient.distance_to_donor_km !== undefined
              ? `${Math.round(patient.distance_to_donor_km)}km`
              : `${patient.transport_eta_min ?? patient.eta_min ?? "—"}m`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Heart className="h-3.5 w-3.5 text-medical-red" />
          <span>HLA {patient.hla_match ?? "—"}%</span>
        </div>
      </div>

      {/* Hospital & Readiness */}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {patient.hospital && (
          <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-slate-400">{patient.hospital}</span>
        )}
        {patient.or_available !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 ${
              patient.or_available ? "bg-medical-green/20 text-medical-green" : "bg-slate-700 text-slate-400"
            }`}
          >
            OR {patient.or_available ? "✓" : "✗"}
          </span>
        )}
        {patient.icu_bed_available !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 ${
              patient.icu_bed_available ? "bg-medical-green/20 text-medical-green" : "bg-slate-700 text-slate-400"
            }`}
          >
            ICU {patient.icu_bed_available ? "✓" : "✗"}
          </span>
        )}
      </div>

      {/* AI Analysis Button */}
      {patient.ai_reasoning && onViewDetails && (
        <button
          onClick={onViewDetails}
          className="mt-3 w-full rounded-lg border border-medical-blue/30 bg-medical-blue/10 p-2 text-xs font-semibold text-medical-blue transition hover:bg-medical-blue/20 hover:border-medical-blue/50 flex items-center justify-center gap-2"
        >
          <Info className="h-3.5 w-3.5" />
          View AI Analysis & Details
        </button>
      )}

      {/* Risk Factors */}
      {(!!patient.hepatocellular_carcinoma ||
        !!patient.diabetes ||
        !!patient.renal_failure ||
        !!patient.ventilator_dependent) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          {patient.hepatocellular_carcinoma && (
            <span className="rounded-full bg-medical-red/20 px-2 py-0.5 text-medical-red">HCC</span>
          )}
          {patient.diabetes && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-orange-400">DM</span>}
          {patient.renal_failure && (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-orange-400">Renal</span>
          )}
          {patient.ventilator_dependent && (
            <span className="rounded-full bg-medical-red/20 px-2 py-0.5 text-medical-red">Vent</span>
          )}
        </div>
      )}

      {/* Allocation Score */}
      {patient.allocation_score !== undefined && (
        <div className="mt-3 rounded-lg bg-slate-800/60 px-3 py-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Allocation Score</p>
          <p className="text-lg font-bold text-medical-blue">{(patient.allocation_score * 100).toFixed(1)}</p>
        </div>
      )}

      {/* Action Buttons - Only show if not already allocated and handlers provided */}
      {!isAccepted && !isAllocated && onContact && onAccept && allocationId && donorQrCode && (
        <div className="mt-4 flex gap-2 border-t border-slate-700 pt-3">
          <button
            onClick={() => onContact(patientId, donorQrCode, patientName)}
            disabled={isContacting || isAccepting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-medical-blue px-3 py-2 text-xs font-semibold text-white transition hover:bg-medical-blue/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Phone className="h-3.5 w-3.5" />
            {isContacting ? "Sending..." : "Contact Surgeon"}
          </button>
          <button
            onClick={() => onAccept(patientId, donorQrCode, allocationId, patientName)}
            disabled={isContacting || isAccepting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-medical-green px-3 py-2 text-xs font-semibold text-white transition hover:bg-medical-green/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {isAccepting ? "Accepting..." : "Accept & Allocate"}
          </button>
        </div>
      )}
    </div>
  );
}

export default AgentLog;
