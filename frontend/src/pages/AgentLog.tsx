import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchAgentHistory } from "../lib/api";

function AgentLog() {
  const [history, setHistory] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(false);
  const { token, openLogin } = useAuth();

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setHistory([]);
        return;
      }
      setLoading(true);
      try {
        const response = await fetchAgentHistory();
        setHistory(response.history ?? []);
      } catch (error) {
        console.error("Unable to load agent history", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Agent Memory</p>
        <h1 className="text-3xl font-bold text-slate-100">Autonomous Allocation Log</h1>
        <p className="text-sm text-slate-500">Pulled directly from LangGraph memory layer.</p>
      </header>
      <div className="grid gap-4">
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
        {loading && <p className="text-xs text-slate-500">Loading history...</p>}
        {!loading && token && history.length === 0 && (
          <p className="text-xs text-slate-500">No allocations have been logged yet.</p>
        )}
        {history.map((entry, index) => (
          <div key={index} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <p className="text-xs uppercase tracking-widest text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-300">
              {JSON.stringify(entry, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentLog;
