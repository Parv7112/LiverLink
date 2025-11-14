import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { registerAdmin } from "../lib/api";

type Mode = "login" | "register";

export function AdminLoginModal() {
  const { loginModal, closeLogin, login, authLoading, authError, pushMessage } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerPayload, setRegisterPayload] = useState({ name: "", email: "", password: "", role: "surgeon" });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    if (!loginModal.open) {
      setEmail("");
      setPassword("");
      setRegisterPayload({ name: "", email: "", password: "", role: "surgeon" });
      setRegisterError(null);
      setMode("login");
    }
  }, [loginModal.open]);

  if (!loginModal.open) return null;

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login(email, password);
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      await registerAdmin(registerPayload);
      pushMessage("Registration successful. Please log in.");
      setMode("login");
      setEmail(registerPayload.email);
      setPassword("");
    } catch (error: any) {
      setRegisterError(error?.response?.data?.detail ?? "Registration failed. Try again.");
    } finally {
      setRegisterLoading(false);
    }
  };

  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="mt-6 space-y-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Email
        <input
          type="email"
          required
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Password
        <input
          type="password"
          required
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {authError && <p className="text-xs text-medical-red">{authError}</p>}
      <div className="flex items-center gap-3">
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={authLoading}
          className="flex-1 rounded-full bg-medical-blue px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-medical-blue/20 transition hover:bg-medical-blue/80 disabled:opacity-60"
        >
          {authLoading ? "Authenticating..." : "Log In"}
        </motion.button>
        <button
          type="button"
          onClick={closeLogin}
          className="rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Need access?{" "}
        <button type="button" className="text-medical-blue underline" onClick={() => setMode("register")}>
          Create an account
        </button>
      </p>
    </form>
  );

  const renderRegisterForm = () => (
    <form onSubmit={handleRegister} className="mt-6 space-y-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Name
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
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Role
        <select
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
          value={registerPayload.role}
          onChange={(event) => setRegisterPayload((prev) => ({ ...prev, role: event.target.value }))}
        >
          <option value="surgeon">Surgeon</option>
          <option value="coordinator">Coordinator</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      {registerError && <p className="text-xs text-medical-red">{registerError}</p>}
      <div className="flex items-center gap-3">
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={registerLoading}
          className="flex-1 rounded-full bg-medical-blue px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-medical-blue/20 transition hover:bg-medical-blue/80 disabled:opacity-60"
        >
          {registerLoading ? "Creating..." : "Register"}
        </motion.button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className="rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:border-slate-500"
        >
          Back to login
        </button>
      </div>
    </form>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {mode === "login" ? "Coordinator Login" : "Create Coordinator"}
          </p>
          <h2 className="text-2xl font-bold text-slate-100">
            {mode === "login" ? "Authenticate to continue" : "Register a coordinator"}
          </h2>
          <p className="text-xs text-slate-400">
            {mode === "login"
              ? loginModal.reason ?? "You must be logged in to perform this action."
              : "Provision a coordinator account for your hospital. Use strong credentials."}
          </p>
        </div>
        {mode === "login" ? renderLoginForm() : renderRegisterForm()}
      </motion.div>
    </div>
  );
}
