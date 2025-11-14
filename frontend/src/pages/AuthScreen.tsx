import { motion } from "framer-motion";
import { useCallback, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { registerAdmin } from "../lib/api";

export function AuthScreen() {
  const { login, authLoading, authError, pushMessage } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [registerPayload, setRegisterPayload] = useState({ name: "", email: "", password: "", role: "surgeon" });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleLogin = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await login(credentials.email, credentials.password, "coordinator");
    },
    [credentials, login]
  );

  const handleRegister = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setRegisterLoading(true);
      setRegisterError(null);
      try {
        await registerAdmin(registerPayload);
        pushMessage("Registration successful. Please log in.");
        setMode("login");
        setCredentials({ email: registerPayload.email, password: "" });
      } catch (error: any) {
        setRegisterError(error?.response?.data?.detail ?? "Registration failed. Try again.");
      } finally {
        setRegisterLoading(false);
      }
    },
    [registerPayload, pushMessage]
  );

  const formCard = (children: React.ReactNode, title: string, subtitle: string) => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">LiverLink Access</p>
      <h1 className="mt-2 text-3xl font-bold text-white">{title}</h1>
      <p className="text-sm text-slate-400">{subtitle}</p>
      {children}
    </motion.div>
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-950 px-6 py-12 text-white">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">LiverLink</p>
        <h1 className="mt-2 text-4xl font-bold">From death to hope in 57 minutes</h1>
        <p className="mt-2 text-sm text-slate-400">Authenticate as a transplant coordinator to launch the allocation agent.</p>
      </div>
      {mode === "login"
        ? formCard(
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email
                <input
                  type="email"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={credentials.email}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
                <input
                  type="password"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={credentials.password}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, password: event.target.value }))}
                />
              </label>
              {authError && <p className="text-xs text-medical-red">{authError}</p>}
              <motion.button
                type="submit"
                whileTap={{ scale: 0.98 }}
                disabled={authLoading}
                className="w-full rounded-full bg-medical-blue px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-medical-blue/30 transition hover:bg-medical-blue/80 disabled:opacity-60"
              >
                {authLoading ? "Authenticating..." : "Log in"}
              </motion.button>
              <p className="text-xs text-slate-500">
                Need an account?{" "}
                <button type="button" className="text-medical-blue underline" onClick={() => setMode("register")}>
                  Register a coordinator
                </button>
              </p>
            </form>,
            "Admin login",
            "Use the credential issued to your transplant center."
          )
        : formCard(
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Full name
                <input
                  type="text"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={registerPayload.name}
                  onChange={(event) => setRegisterPayload((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email
                <input
                  type="email"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={registerPayload.email}
                  onChange={(event) => setRegisterPayload((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
                <input
                  type="password"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={registerPayload.password}
                  onChange={(event) => setRegisterPayload((prev) => ({ ...prev, password: event.target.value }))}
                />
              </label>
              {registerError && <p className="text-xs text-medical-red">{registerError}</p>}
              <motion.button
                type="submit"
                whileTap={{ scale: 0.98 }}
                disabled={registerLoading}
                className="w-full rounded-full bg-medical-blue px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-medical-blue/30 transition hover:bg-medical-blue/80 disabled:opacity-60"
              >
                {registerLoading ? "Creating..." : "Register"}
              </motion.button>
              <p className="text-xs text-slate-500">
                Already registered?{" "}
                <button type="button" className="text-medical-blue underline" onClick={() => setMode("login")}>
                  Back to login
                </button>
              </p>
            </form>,
            "Create coordinator",
            "Provision access for your transplant command center."
          )}
    </div>
  );
}
