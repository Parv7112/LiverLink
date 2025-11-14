import { motion } from "framer-motion";
import { ActivitySquare, Brain, CheckCircle2, Globe, LayoutDashboard, LogOut, ShieldCheck, Smartphone, UserCircle2, Zap } from "lucide-react";
import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const heroHighlights = [
  { label: "Avg. allocation time", value: "57 min" },
  { label: "Surgeons on-call", value: "120+" },
  { label: "Realtime alerts sent", value: "3.5k" },
];

const features = [
  {
    icon: <ShieldCheck className="h-6 w-6 text-medical-green" />,
    title: "Role-based security",
    description: "Coordinators, surgeons, and admins each get focused tools with audit trails.",
  },
  {
    icon: <ActivitySquare className="h-6 w-6 text-medical-blue" />,
    title: "AI allocation agent",
    description: "LangGraph pipeline fetches waitlists, predicts survival, ranks, and notifies in seconds.",
  },
  {
    icon: <Smartphone className="h-6 w-6 text-medical-purple" />,
    title: "Mobile-first ops",
    description: "QR scanning, alert feeds, and dashboards are tuned for phones and tablets from day one.",
  },
  {
    icon: <Globe className="h-6 w-6 text-medical-gold" />,
    title: "Realtime collaboration",
    description: "Socket.IO + WebSockets keep OR teams, coordinators, and AI in sync.",
  },
];

const timeline = [
  { step: "Scan donor wristband", detail: "QR intake captures labs, OR ETA, and hospital details." },
  { step: "AI agent spins up", detail: "Fetch → predict → rank flows stream to dashboards instantly." },
  { step: "Surgeon alerted", detail: "SMS + mobile alerts include MELD, survival odds, and reasoning." },
  { step: "Allocation locked", detail: "OR readiness, confetti moments, and post-run Langfuse logs." },
];

export default function Home() {
  const { openLogin, user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDashActions, setShowDashActions] = useState(false);
  const [showAuthActions, setShowAuthActions] = useState(false);
  const scrollToSection = (id: string) => {
    const node = document.getElementById(id);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-20 pb-24">
      <motion.header
        className="flex flex-col gap-4 rounded-[2.5rem] border border-white/5 bg-slate-950/80 p-6 shadow-[0_15px_60px_rgba(2,6,23,0.6)] md:flex-row md:items-center md:justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-900/80 p-3 text-medical-blue shadow-inner shadow-medical-blue/40">
            <Brain className="h-8 w-8" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">LiverLink</p>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">From death to hope in 57 minutes</p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-200 md:w-auto md:flex-nowrap">
          <button className="rounded-full border border-slate-800/80 bg-slate-900/80 px-4 py-2 shadow-inner shadow-black/40 transition hover:border-slate-600 hover:text-white" onClick={() => scrollToSection("features")}>
            Features
          </button>
          <button className="rounded-full border border-slate-800/80 bg-slate-900/80 px-4 py-2 shadow-inner shadow-black/40 transition hover:border-slate-600 hover:text-white" onClick={() => scrollToSection("workflow")}>
            Workflow
          </button>
          <button className="rounded-full border border-slate-800/80 bg-slate-900/80 px-4 py-2 shadow-inner shadow-black/40 transition hover:border-slate-600 hover:text-white" onClick={() => scrollToSection("snapshot")}>
            Snapshot
          </button>
          {!user && (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowAuthActions((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-medical-blue text-white shadow-lg shadow-medical-blue/40 transition hover:bg-medical-blue/85"
                >
                  <UserCircle2 className="h-5 w-5" />
                </button>
                {!user && showAuthActions && (
                  <div className="absolute right-0 z-10 mt-3 w-44 rounded-2xl border border-slate-800 bg-slate-950/90 p-2 shadow-2xl shadow-black/40">
                    <button
                      onClick={() => {
                        openLogin("Authenticate to unlock the dashboard", "login");
                        setShowAuthActions(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-slate-900"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => {
                        openLogin("Request coordinator credentials", "register");
                        setShowAuthActions(false);
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-slate-900"
                    >
                      Register
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {user?.role === "coordinator" && (
            <div className="relative">
              <button
                onClick={() => setShowDashActions((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-medical-blue text-white shadow-lg shadow-medical-blue/40 transition hover:bg-medical-blue/85"
              >
                <LayoutDashboard className="h-5 w-5" />
              </button>
              {showDashActions && (
                <div className="absolute right-0 z-10 mt-3 w-44 rounded-2xl border border-slate-800 bg-slate-950/90 p-2 shadow-2xl shadow-black/40">
                  <button
                    onClick={() => {
                      navigate("/dashboard");
                      setShowDashActions(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-slate-900"
                  >
                    <LayoutDashboard className="h-4 w-4 text-medical-blue" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setShowDashActions(false);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-medical-red transition hover:bg-slate-900"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.header>

      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-medical-blue/20 p-8 shadow-[0_25px_150px_rgba(15,23,42,0.35)]">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-slate-300">
            <Zap className="h-3.5 w-3.5 text-medical-gold" /> Live organ allocation
          </p>
          <h1 className="mt-6 text-4xl font-black leading-tight text-white md:text-5xl">
            Autonomy for transplant teams.
            <span className="block text-medical-blue">Compassion for patients.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-300">
            LiverLink unifies AI planning, clinical collaboration, and observability so coordinators can move from donor scan to liver lock-in in minutes—not hours.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-full bg-medical-blue px-8 py-3 text-sm font-semibold uppercase tracking-widest text-white shadow-lg shadow-medical-blue/40"
              onClick={() => openLogin("Log in to continue", "login")}
            >
              Launch Dashboard
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-full border border-slate-600 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-slate-200"
              onClick={() => openLogin("Create your coordinator account", "register")}
            >
              Create Account
            </motion.button>
          </div>
        </motion.div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {heroHighlights.map((item, index) => (
            <motion.div
              key={item.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-4 text-slate-100 backdrop-blur"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{item.label}</p>
              <p className="mt-2 text-2xl font-bold">{item.value}</p>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_transparent_55%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2 }}
        />
      </section>

      <section id="features" className="grid gap-8 md:grid-cols-2">
        <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900/60 p-8 shadow-inner">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Why LiverLink</p>
          <h2 className="mt-4 text-3xl font-bold text-white">Purpose-built for transplant storms</h2>
          <p className="mt-3 text-sm text-slate-400">
            From the first wristband scan to the final surgeon confirmation, LiverLink layers AI agents, predictive survival modeling, and realtime messaging to clear backlogs and give coordinators their nights back.
          </p>
          <div className="mt-8 space-y-5">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="flex items-start gap-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-4"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="rounded-2xl bg-slate-950/60 p-3">{feature.icon}</div>
                <div>
                  <p className="text-base font-semibold text-white">{feature.title}</p>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div id="workflow" className="rounded-[2.5rem] border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Live flow</p>
          <h2 className="mt-4 text-3xl font-bold text-white">From donor scan to OR lock-in</h2>
          <div className="mt-8 space-y-4">
            {timeline.map((item, index) => (
              <motion.div
                key={item.step}
                className="flex gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-4"
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-medical-blue/20 text-medical-blue">
                  <span className="text-sm font-semibold">{index + 1}</span>
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{item.step}</p>
                  <p className="text-sm text-slate-400">{item.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="snapshot" className="rounded-[2.5rem] border border-slate-800 bg-slate-900/70 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Platform Snapshot</p>
            <h2 className="mt-4 text-3xl font-bold text-white">Everything coordinators need in one launchpad</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => openLogin("Authenticate to unlock the dashboard", "login")}
              className="rounded-full border border-slate-700 px-6 py-2 text-xs font-semibold uppercase tracking-widest text-slate-200"
            >
              Log In
            </button>
            <button
              onClick={() => openLogin("Request coordinator credentials", "register")}
              className="rounded-full bg-medical-blue px-6 py-2 text-xs font-semibold uppercase tracking-widest text-white"
            >
              Register
            </button>
          </div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <FeatureStat
            icon={<Brain className="h-6 w-6 text-medical-blue" />}
            title="LangGraph Agent"
            detail="Fetches patients, predicts 6-hour survival, ranks & re-plans automatically."
          />
          <FeatureStat
            icon={<CheckCircle2 className="h-6 w-6 text-medical-green" />}
            title="Narrative reasoning feed"
            detail="Surgeons see every decision + acceptance status in realtime cards."
          />
          <FeatureStat
            icon={<ShieldCheck className="h-6 w-6 text-medical-gold" />}
            title="Observability ready"
            detail="Langfuse traces, MongoDB memory, and secure JWT auth out of the box."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureStat({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <motion.div
      className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <div className="mb-3 inline-flex rounded-2xl bg-slate-900/80 p-3">{icon}</div>
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="text-sm text-slate-400">{detail}</p>
    </motion.div>
  );
}

