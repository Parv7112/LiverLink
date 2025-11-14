import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { CandidateSummary } from "../lib/agent";

type Props = {
  attempt: number;
  status: string;
  message: string;
  patient?: CandidateSummary;
};

export function AlertCard({ attempt, status, message, patient }: Props) {
  const isAccepted = status === "accepted";
  return (
    <motion.div
      className={`rounded-2xl border p-4 text-sm ${
        isAccepted ? "border-medical-green/60 bg-medical-green/10" : "border-medical-blue/40 bg-slate-900/60"
      }`}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {isAccepted ? <CheckCircle className="h-4 w-4 text-medical-green" /> : <AlertTriangle className="h-4 w-4 text-medical-blue" />}
          <span>Attempt {attempt}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
          <Clock className="h-3 w-3" />
          <span>{status}</span>
        </div>
      </div>
      <p className="mt-3 text-base font-semibold text-slate-100">{message}</p>
      {patient && (
        <p className="mt-2 text-xs text-slate-400">
          Patient {patient.name} · Blood {patient.blood_type ?? "—"} · MELD {patient.meld ?? "—"} · 6hr{" "}
          {Math.round((patient.survival_6hr_prob ?? patient.survival_hint ?? 0) * 100)}% · ETA{" "}
          {patient.transport_eta_min ?? patient.eta_min ?? "—"}m · OR {patient.or_available ? "ready" : "standby"}
        </p>
      )}
    </motion.div>
  );
}
