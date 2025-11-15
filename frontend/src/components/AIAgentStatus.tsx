import { motion } from "framer-motion";
import { Brain, Loader2 } from "lucide-react";
import { AgentStatus } from "../lib/agent";

type Props = {
  status: AgentStatus;
  progress: Array<{ step: string; complete: boolean; active: boolean }>;
};

const stepLabels: Record<string, string> = {
  fetch_patients: "Fetch",
  predict: "Predict",
  rank: "Rank",
  alert: "Alert",
  evaluate: "Evaluate",
};

export function AIAgentStatus({ status, progress }: Props) {
  return (
    <motion.section
      className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="rounded-2xl bg-medical-blue/20 p-3 text-medical-blue"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          >
            <Brain className="h-7 w-7" />
          </motion.div>
          <div>
            <p className="text-lg font-semibold uppercase tracking-wider text-slate-300">AI Agent Status</p>
            <p className="text-2xl font-bold text-slate-50">{status.lastMessage}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-medical-green" />
          <span>Iteration {status.iteration}</span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        {progress.map((item) => (
          <div key={item.step} className="flex items-center gap-2">
            <div
              className={`h-2 w-16 rounded-full transition ${
                item.complete ? "bg-medical-green" : item.active ? "bg-medical-blue" : "bg-slate-700"
              }`}
            />
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${
                item.active ? "text-medical-blue" : "text-slate-500"
              }`}
            >
              {stepLabels[item.step] ?? item.step}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-400">Live Reasoning</p>
          <div className="h-40 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
            {status.reasoning.length === 0 && <p className="text-xs text-slate-500">Awaiting agent activity.</p>}
            {status.reasoning
              .slice()
              .reverse()
              .map((line, index) => (
                <motion.p
                  key={`${line}-${index}`}
                  className="mb-2 rounded-xl bg-slate-900/60 p-3"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {line}
                </motion.p>
              ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-400">Top Candidates</p>
          <div className="space-y-3">
            {status.topCandidates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
                No candidates ranked yet. Scan a donor wristband to start allocation.
              </div>
            )}
            {status.topCandidates.map((candidate, idx) => (
              <motion.div
                key={candidate.id ?? idx}
                className={`rounded-2xl border p-4 transition ${
                  (candidate.survival_6hr_prob ?? 0) < 0.6 ? "border-medical-red/60" : "border-medical-green/40"
                }`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-100">{candidate.name ?? "Unknown"}</p>
                    <p className="text-xs uppercase text-slate-500">
                      MELD {candidate.meld ?? "—"} · Wait {candidate.waitlist_days ?? "—"}d · ETA{" "}
                      {candidate.eta_min ?? candidate.transport_eta_min ?? "—"}m
                    </p>
                    <p className="text-[11px] uppercase text-slate-500">
                      Blood {candidate.blood_type ?? "—"} · Age {candidate.age ?? "—"} · OR{" "}
                      {candidate.or_available ? "Ready" : "Standby"}
                    </p>
                    <p className="text-[11px] uppercase text-slate-500">
                      1yr {candidate.predicted_1yr_survival ?? "—"}% · Death risk {candidate.death_risk_6hr ?? "—"}%
                    </p>
                  </div>
                  <motion.span
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      (candidate.survival_6hr_prob ?? 0) < 0.6
                        ? "bg-medical-red/20 text-medical-red"
                        : "bg-medical-green/20 text-medical-green"
                    }`}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 3, delay: idx * 0.2 }}
                  >
                    {Math.round((candidate.survival_6hr_prob ?? 0) * 100)}%
                  </motion.span>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Allocation score {(candidate.allocation_score ?? 0).toFixed(2)} · HLA {candidate.hla_match ?? "—"}%
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
