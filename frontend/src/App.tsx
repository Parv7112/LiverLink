import { motion } from "framer-motion";
import { Brain, ActivitySquare, QrCode, History } from "lucide-react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AgentLog from "./pages/AgentLog";
import DonorScan from "./pages/DonorScan";
import SurgeonDashboard from "./pages/SurgeonDashboard";

function AppShell() {
  const { token, logout, openLogin, bannerMessage, dismissMessage } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-inter">
      <header className="sticky top-0 z-20 backdrop-blur shadow-md border-b border-slate-800 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="rounded-xl bg-medical-blue/20 p-2 text-medical-blue">
              <Brain className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-semibold">LiverLink</p>
              <p className="text-xs uppercase tracking-widest text-slate-400">
                From death to hope in 57 minutes
              </p>
            </div>
          </motion.div>
          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-full px-4 py-2 font-medium transition hover:bg-slate-800" to="/scan">
              <span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4" /> Donor Scan</span>
            </Link>
            <Link className="rounded-full px-4 py-2 font-medium transition hover:bg-slate-800" to="/dashboard">
              <span className="inline-flex items-center gap-2"><ActivitySquare className="h-4 w-4" /> OR Dashboard</span>
            </Link>
            <Link className="rounded-full px-4 py-2 font-medium transition hover:bg-slate-800" to="/agent-log">
              <span className="inline-flex items-center gap-2"><History className="h-4 w-4" /> Agent Log</span>
            </Link>
            {token ? (
              <button
                onClick={logout}
                className="rounded-full border border-slate-700 px-4 py-2 font-semibold uppercase tracking-wide text-xs text-slate-200 transition hover:border-medical-red/60 hover:text-medical-red"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => openLogin()}
                className="rounded-full bg-medical-blue px-4 py-2 font-semibold uppercase tracking-wide text-xs text-white shadow-medical-blue/30 transition hover:bg-medical-blue/80"
              >
                Admin Login
              </button>
            )}
          </nav>
        </div>
      </header>
      {bannerMessage && (
        <div className="mx-auto mt-4 max-w-4xl rounded-2xl border border-medical-green/40 bg-medical-green/10 px-4 py-3 text-sm text-medical-green">
          <div className="flex items-center justify-between gap-4">
            <span>{bannerMessage}</span>
            <button className="text-xs uppercase tracking-widest" onClick={dismissMessage}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <Routes>
          <Route path="/" element={<SurgeonDashboard />} />
          <Route path="/dashboard" element={<SurgeonDashboard />} />
          <Route path="/scan" element={<DonorScan />} />
          <Route path="/agent-log" element={<AgentLog />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
        <AdminLoginModal />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
