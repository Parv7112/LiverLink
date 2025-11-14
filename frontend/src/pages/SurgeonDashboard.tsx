import Confetti from "react-confetti";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { AlertCard } from "../components/AlertCard";
import { AIAgentStatus } from "../components/AIAgentStatus";
import { SurvivalCard } from "../components/SurvivalCard";
import { useAgentFeed } from "../lib/agent";

function SurgeonDashboard() {
  const { status, events, progress } = useAgentFeed();
  const displayCandidates = useMemo(() => status.topCandidates.slice(0, 3), [status.topCandidates]);
  const showConfetti = Boolean(status.acceptedPatient);

  return (
    <div className="space-y-8">
      {showConfetti && <Confetti numberOfPieces={250} recycle={false} gravity={0.3} />}
      <AIAgentStatus status={status} progress={progress} />

      <section className="grid gap-6 md:grid-cols-3">
        {displayCandidates.map((candidate, index) => (
          <SurvivalCard key={candidate.id ?? index} candidate={candidate} />
        ))}
      </section>

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
