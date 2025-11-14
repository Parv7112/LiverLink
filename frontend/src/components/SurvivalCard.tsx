import { motion } from "framer-motion";
import { Activity, Droplets, ShieldAlert, Stethoscope } from "lucide-react";
import { CandidateSummary } from "../lib/agent";

type Props = {
  candidate: CandidateSummary;
};

export function SurvivalCard({ candidate }: Props) {
  const survival = Math.round((candidate.survival_6hr_prob ?? candidate.survival_hint ?? 0) * 100);
  const oneYear = Math.round(candidate.predicted_1yr_survival ?? Math.max(0, 100 - (candidate.death_risk_6hr ?? 0)));
  const deathRisk = candidate.death_risk_6hr ?? null;
  const eta = candidate.transport_eta_min ?? candidate.eta_min;
  const isCritical = survival < 60;
  return (
    <motion.div
      className={`relative overflow-hidden rounded-3xl border p-5 transition ${
        isCritical ? "border-medical-red/60 bg-medical-red/10" : "border-medical-blue/50 bg-slate-900/60"
      }`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-slate-100">{candidate.name ?? "Candidate"}</p>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            Blood {candidate.blood_type ?? "—"} · Age {candidate.age ?? "—"} · OR{" "}
            {candidate.or_available ? "Ready" : "Standby"}
          </p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
            MELD {candidate.meld ?? "—"} · HLA {candidate.hla_match ?? "—"}%
          </p>
        </div>
        <motion.div
          className={`rounded-full px-4 py-2 text-sm font-bold ${
            isCritical ? "bg-medical-red/30 text-medical-red" : "bg-medical-green/20 text-medical-green"
          }`}
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 2.8 }}
        >
          {survival}% 6hr
        </motion.div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
        <div className="rounded-xl bg-slate-900/80 p-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Activity className="h-3 w-3 text-medical-blue" /> Wait Days
          </p>
          <p className="mt-2 text-base font-semibold">{candidate.waitlist_days ?? "—"}</p>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Transport ETA</p>
          <p className="mt-2 text-base font-semibold">{eta ?? "—"} min</p>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Stethoscope className="h-3 w-3 text-medical-green" /> 1yr Survival
          </p>
          <p className="mt-2 text-base font-semibold">{isNaN(oneYear) ? "—" : `${oneYear}%`}</p>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <ShieldAlert className="h-3 w-3 text-medical-red" /> Death Risk
          </p>
          <p className="mt-2 text-base font-semibold">
            {deathRisk !== null ? `${Math.round(deathRisk)}%` : "—"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-widest text-slate-400">
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-200">
          Score {(candidate.allocation_score ?? 0).toFixed(2)}
        </span>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-200">
          HLA Match {candidate.hla_match ?? "—"}%
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-slate-200">
          <Droplets className="h-3 w-3 text-medical-blue" /> OR {candidate.or_available ? "Prepped" : "Standby"}
        </span>
      </div>
    </motion.div>
  );
}
