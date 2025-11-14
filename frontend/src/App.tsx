import { motion } from "framer-motion";
import { Brain, ActivitySquare, QrCode, History, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminLoginModal } from "./components/AdminLoginModal";
import { RouteGuard } from "./components/RouteGuard";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AgentLog from "./pages/AgentLog";
import DonorScan from "./pages/DonorScan";
import Home from "./pages/Home";
import SurgeonDashboard from "./pages/SurgeonDashboard";

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const allowHome = Boolean(location.state && (location.state as Record<string, any>).allowHome);
  const isHomeRoute = location.pathname === "/";
  const { token, user, logout, openLogin, bannerMessage, dismissMessage } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMenu = () => setMobileNavOpen(false);
  const isCoordinator = Boolean(user && user.role === "coordinator");

  useEffect(() => {
    if (user?.role === "coordinator" && location.pathname === "/" && !allowHome) {
      navigate("/dashboard", { replace: true });
    } else if (!user && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [user, location.pathname, navigate, allowHome]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-inter">
      {!isHomeRoute && (
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
          <nav className="hidden items-center gap-3 text-sm md:flex">
            <Link className="rounded-full px-4 py-2 font-medium transition hover:bg-slate-800" to="/" state={{ allowHome: true }}>
              Home
            </Link>
            {isCoordinator && (
              <>
                <Link className="rounded-full px-4 py-2 font-medium transition hover:bg-slate-800" to="/scan">
                  <span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4" /> Donor Scan</span>
                </Link>
                <Link className="rounded-full px-4 py-2 font-medium transition hover:bg-slate-800" to="/dashboard">
                  <span className="inline-flex items-center gap-2"><ActivitySquare className="h-4 w-4" /> OR Dashboard</span>
                </Link>
                <Link className="rounded-full px-4 py-2 font-medium transition hover:bg-slate-800" to="/agent-log">
                  <span className="inline-flex items-center gap-2"><History className="h-4 w-4" /> Agent Log</span>
                </Link>
              </>
            )}
            {token ? (
              <button
                onClick={logout}
                className="rounded-full border border-slate-700 px-4 py-2 font-semibold uppercase tracking-wide text-xs text-slate-200 transition hover:border-medical-red/60 hover:text-medical-red"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => openLogin("Authenticate to access coordinator tools", "login")}
                className="rounded-full bg-medical-blue px-4 py-2 font-semibold uppercase tracking-wide text-xs text-white shadow-medical-blue/30 transition hover:bg-medical-blue/80"
              >
                Admin Login
              </button>
            )}
          </nav>
          <button
            className="rounded-full border border-slate-800 p-2 text-slate-200 md:hidden"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileNavOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="md:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 pb-4 text-sm">
              <Link onClick={closeMenu} className="rounded-2xl border border-slate-800 px-4 py-3" to="/" state={{ allowHome: true }}>
                Home
              </Link>
              {isCoordinator && (
                <>
                  <Link onClick={closeMenu} className="rounded-2xl border border-slate-800 px-4 py-3" to="/scan">
                    <span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4" /> Donor Scan</span>
                  </Link>
                  <Link onClick={closeMenu} className="rounded-2xl border border-slate-800 px-4 py-3" to="/dashboard">
                    <span className="inline-flex items-center gap-2"><ActivitySquare className="h-4 w-4" /> OR Dashboard</span>
                  </Link>
                  <Link onClick={closeMenu} className="rounded-2xl border border-slate-800 px-4 py-3" to="/agent-log">
                    <span className="inline-flex items-center gap-2"><History className="h-4 w-4" /> Agent Log</span>
                  </Link>
                </>
              )}
              {token ? (
                <button
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="rounded-2xl border border-slate-800 px-4 py-3 text-left font-semibold text-medical-red"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => {
                    openLogin("Authenticate to access coordinator tools", "login");
                    closeMenu();
                  }}
                  className="rounded-2xl border border-slate-800 px-4 py-3 text-left font-semibold text-medical-blue"
                >
                  Admin Login
                </button>
              )}
            </div>
          </motion.nav>
        )}
        </header>
      )}
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
          <Route path="/" element={<Home />} />
          <Route
            path="/dashboard"
            element={
              <RouteGuard allowedRoles={["coordinator"]} reason="Coordinator credentials required for the OR dashboard.">
                <SurgeonDashboard />
              </RouteGuard>
            }
          />
          <Route
            path="/scan"
            element={
              <RouteGuard allowedRoles={["coordinator"]} reason="Coordinator credentials required for donor intake.">
                <DonorScan />
              </RouteGuard>
            }
          />
          <Route
            path="/agent-log"
            element={
              <RouteGuard allowedRoles={["coordinator"]} reason="Coordinator access required for agent history.">
                <AgentLog />
              </RouteGuard>
            }
          />
          <Route path="*" element={<Home />} />
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
