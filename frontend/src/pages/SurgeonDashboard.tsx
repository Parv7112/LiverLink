import Confetti from "react-confetti";
import { motion } from "framer-motion";
  import { useEffect, useMemo, useState } from "react";
import { AlertCard } from "../components/AlertCard";
import { AIAgentStatus } from "../components/AIAgentStatus";
import { SurvivalCard } from "../components/SurvivalCard";
import { CandidateSummary, useAgentFeed } from "../lib/agent";
import { fetchAgentHistory } from "../lib/api";

type AllocationEntry = {
  _id?: string;
  timestamp?: string;
  donor?: {
    qr_code_id?: string;
    organ?: string;
    blood_type?: string;
    age?: number;
  };
  accepted_patient?: any;
  ranked_patients?: any[];
};

const toCandidateSummary = (candidate: any): CandidateSummary => ({
  id: candidate?.id ?? candidate?._id ?? candidate?.patient_id,
  name: candidate?.name ?? "Unknown",
  meld: candidate?.meld ?? candidate?.MELD ?? null,
  waitlist_days: candidate?.waitlist_days ?? candidate?.wait_days ?? null,
  eta_min: candidate?.eta_min ?? candidate?.transport_eta_min ?? null,
  transport_eta_min: candidate?.transport_eta_min ?? candidate?.eta_min ?? null,
  survival_6hr_prob: candidate?.survival_6hr_prob ?? candidate?.survival_hint ?? null,
  allocation_score: candidate?.allocation_score ?? null,
  hla_match: candidate?.hla_match ?? null,
  blood_type: candidate?.blood_type ?? candidate?.blood ?? null,
  age: candidate?.age ?? null,
  predicted_1yr_survival: candidate?.predicted_1yr_survival ?? null,
  death_risk_6hr: candidate?.death_risk_6hr ?? null,
  or_available: candidate?.or_available ?? null,
});

const formatTimestamp = (timestamp?: string) =>
  timestamp ? new Date(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Latest allocation";

function SurgeonDashboard() {
  const { status, events, progress } = useAgentFeed();
  const [latestAllocation, setLatestAllocation] = useState<AllocationEntry | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const displayCandidates = useMemo(() => status.topCandidates.slice(0, 3), [status.topCandidates]);
  const fallbackCandidates = useMemo(() => {
    if (displayCandidates.length > 0 || !latestAllocation?.ranked_patients) {
      return [];
    }
    return latestAllocation.ranked_patients.slice(0, 3).map(toCandidateSummary);
  }, [displayCandidates.length, latestAllocation]);
  const showConfetti = Boolean(status.acceptedPatient);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetchAgentHistory();
        if (!active) return;
        const [latest] = response.history ?? [];
        setLatestAllocation(latest ?? null);
      } catch (error: any) {
        if (active) {
          setHistoryError(error?.response?.data?.detail ?? "Unable to load recent allocations.");
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      {showConfetti && <Confetti numberOfPieces={250} recycle={false} gravity={0.3} />}
      <AIAgentStatus status={status} progress={progress} />

      <section className="grid gap-6 md:grid-cols-3">
        {(displayCandidates.length > 0 ? displayCandidates : fallbackCandidates).map((candidate, index) => (
          <SurvivalCard key={candidate.id ?? index} candidate={candidate} />
        ))}
        {displayCandidates.length === 0 && fallbackCandidates.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400 md:col-span-3">
            No ranked candidates yet. Trigger an allocation to populate this view.
          </div>
        )}
      </section>

      {latestAllocation && (
        <LatestAllocationCard allocation={latestAllocation} loading={historyLoading} error={historyError} />
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Surgeon Alerts</p>
          <div className="mt-4 space-y-3">
            {status.alerts.length === 0 && <p className="text-xs text-slate-500">No alerts yet.</p>}
            {status.alerts.map((alert, index) => (
              <AlertCard key={`${alert.message}-${index}`} {...alert} />
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Agent Timeline</p>
          <div className="mt-4 h-56 overflow-y-auto space-y-3 text-xs text-slate-400">
            {events.length === 0 && <p>No agent activity recorded.</p>}
            {events.slice().reverse().map((event, index) => (
              <motion.div
                key={`${event.event}-${index}`}
                className="rounded-2xl bg-slate-800/40 p-3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{event.event}</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-300">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default SurgeonDashboard;

function LatestAllocationCard({ allocation, loading, error }: { allocation: AllocationEntry | null; loading: boolean; error: string | null }) {
  if (!allocation) return null;
  const accepted = allocation.accepted_patient ? toCandidateSummary(allocation.accepted_patient) : null;
  const ranked = allocation.ranked_patients?.slice(0, 3) ?? [];

  return (
    <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{formatTimestamp(allocation.timestamp)}</p>
          <h2 className="text-2xl font-semibold text-white">
            {allocation.donor?.organ ? `${allocation.donor.organ.toUpperCase()} Allocation` : "Recent Allocation"}
          </h2>
          <p className="text-sm text-slate-400">
            Donor {allocation.donor?.qr_code_id ?? "—"} · {allocation.donor?.blood_type ?? "?"} · Age {allocation.donor?.age ?? "?"}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
            accepted ? "bg-medical-green/15 text-medical-green" : "bg-slate-800 text-slate-400"
          }`}
        >
          {accepted ? "Allocated" : loading ? "Loading..." : "Idle"}
        </span>
      </header>

      {error && <p className="rounded-2xl border border-medical-red/40 bg-medical-red/10 p-3 text-sm text-medical-red">{error}</p>}

      {accepted && (
        <div className="rounded-2xl border border-medical-green/40 bg-medical-green/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-medical-green mb-2">Organ Allocated To</p>
          <div className="flex flex-wrap items-baseline gap-4">
            <div>
              <p className="text-lg font-semibold text-white">{accepted.name}</p>
              <p className="text-sm text-slate-400">
                {accepted.blood_type ?? "?"} · {accepted.age ?? "?"} years · HLA {accepted.hla_match ?? "—"}%
              </p>
            </div>
            <div className="rounded-full bg-medical-green/20 px-4 py-1 text-sm font-semibold text-medical-green">
              {accepted.survival_6hr_prob ? Math.round(accepted.survival_6hr_prob * 100) : 0}%
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            MELD {accepted.meld ?? "—"} · Wait {accepted.waitlist_days ?? "—"}d · ETA {accepted.transport_eta_min ?? accepted.eta_min ?? "—"}m
          </p>
        </div>
      )}

      {ranked.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Ranked Candidates</p>
          <div className="grid gap-3 md:grid-cols-3">
            {ranked.map((candidate, index) => {
              const summary = toCandidateSummary(candidate);
              return (
                <div key={summary.id ?? index} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{summary.name}</p>
                      <p className="text-xs text-slate-500">{summary.blood_type ?? "?"}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <span>MELD {summary.meld ?? "—"}</span>
                    <span>Wait {summary.waitlist_days ?? "—"}d</span>
                    <span>HLA {summary.hla_match ?? "—"}%</span>
                    <span>Score {(summary.allocation_score ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
