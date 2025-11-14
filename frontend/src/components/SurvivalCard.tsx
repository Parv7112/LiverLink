import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { CandidateSummary } from "../lib/agent";

type Props = {
  candidate: CandidateSummary;
};

export function SurvivalCard({ candidate }: Props) {
  const survival = Math.round((candidate.survival_6hr_prob ?? 0) * 100);
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
          {survival}% survival
        </motion.div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-300">
        <div className="rounded-xl bg-slate-900/80 p-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Activity className="h-3 w-3 text-medical-blue" /> Wait Days
          </p>
          <p className="mt-2 text-base font-semibold">{candidate.waitlist_days ?? "—"}</p>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">ETA (min)</p>
          <p className="mt-2 text-base font-semibold">{candidate.eta_min ?? "—"}</p>
        </div>
        <div className="rounded-xl bg-slate-900/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Score</p>
          <p className="mt-2 text-base font-semibold">{(candidate.allocation_score ?? 0).toFixed(2)}</p>
        </div>
      </div>
    </motion.div>
  );
}
