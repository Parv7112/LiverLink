import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { registerAdmin } from "../lib/api";

type Mode = "login" | "register";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmailValid = (value: string) => emailRegex.test(value.trim());
const inputClasses = (errored?: boolean) =>
  `w-full rounded-xl border bg-slate-900/60 p-3 text-sm transition outline-none ${
    errored
      ? "border-medical-red/70 text-medical-red placeholder-medical-red/60 shadow-[0_0_15px_rgba(239,68,68,0.15)] focus:border-medical-red/80 focus:ring-2 focus:ring-medical-red/30"
      : "border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-medical-blue focus:ring-2 focus:ring-medical-blue/30"
  }`;

export function AdminLoginModal() {
  const { loginModal, closeLogin, login, logout, authLoading, authError, pushMessage } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerPayload, setRegisterPayload] = useState({ name: "", email: "", password: "", role: "surgeon" });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [loginEmailTouched, setLoginEmailTouched] = useState(false);
  const [registerEmailTouched, setRegisterEmailTouched] = useState(false);
  const [loginRole, setLoginRole] = useState<"coordinator" | "surgeon" | "admin">("coordinator");
  const [registerEmailConflict, setRegisterEmailConflict] = useState(false);

  useEffect(() => {
    if (!loginModal.open) {
      setEmail("");
      setPassword("");
      setRegisterPayload({ name: "", email: "", password: "", role: "surgeon" });
      setRegisterError(null);
      setLoginEmailTouched(false);
      setRegisterEmailTouched(false);
      setMode("login");
      setLoginRole("coordinator");
      setRegisterEmailConflict(false);
    } else {
      const nextMode = loginModal.mode ?? "login";
      setMode(nextMode);
      if (nextMode === "register") {
        setRegisterEmailTouched(false);
        setRegisterEmailConflict(false);
      } else {
        setLoginEmailTouched(false);
        setLoginRole("coordinator");
      }
    }
  }, [loginModal.open, loginModal.mode]);

  if (!loginModal.open) return null;

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login(email, password, loginRole);
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterLoading(true);
    setRegisterError(null);
    setRegisterEmailConflict(false);
    try {
      await registerAdmin(registerPayload);
      pushMessage("Registration successful. Please log in.");
      setMode("login");
      setEmail(registerPayload.email);
      setPassword("");
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? "Registration failed. Try again.";
      setRegisterError(detail);
      if (typeof detail === "string" && detail.toLowerCase().includes("already")) {
        setRegisterEmailConflict(true);
        setRegisterEmailTouched(true);
      }
      pushMessage(detail);
    } finally {
      setRegisterLoading(false);
    }
  };

  const loginEmailInvalid = loginEmailTouched && !isEmailValid(email);
  const registerEmailInvalid = registerEmailTouched && !isEmailValid(registerPayload.email);

  const canSubmitLogin = !loginEmailInvalid && email.trim().length > 3 && password.trim().length >= 6;
  const canSubmitRegister =
    !registerEmailInvalid &&
    registerPayload.name.trim().length > 2 &&
    registerPayload.password.length >= 8;

  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="mt-6 space-y-4">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Email
        <input
          type="email"
          required
          className={`mt-2 ${inputClasses(loginEmailInvalid)}`}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setLoginEmailTouched(true);
          }}
          onBlur={() => setLoginEmailTouched(true)}
        />
      </label>
      {loginEmailInvalid && <p className="text-xs text-medical-red">Enter a valid email address.</p>}
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Role
        <select
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
          value={loginRole}
          onChange={(event) => setLoginRole(event.target.value as typeof loginRole)}
        >
          <option value="coordinator">Coordinator</option>
          <option value="surgeon">Surgeon</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Password
        <div className="mt-2 flex items-center rounded-xl border border-slate-700 bg-slate-900/60 pr-2">
          <input
            type={showLoginPassword ? "text" : "password"}
            required
            className="w-full rounded-xl bg-transparent p-3 text-sm text-slate-100 outline-none"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            minLength={6}
          />
          <button
            type="button"
            aria-label={showLoginPassword ? "Hide password" : "Show password"}
            className="text-slate-400 transition hover:text-slate-200"
            onClick={() => setShowLoginPassword((prev) => !prev)}
          >
            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      {authError && <p className="text-xs text-medical-red">{authError}</p>}
      <div className="flex items-center gap-3">
        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          disabled={authLoading || !canSubmitLogin}
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
          className={`mt-2 ${inputClasses(registerEmailInvalid || registerEmailConflict)}`}
          value={registerPayload.email}
          onChange={(event) => {
            setRegisterPayload((prev) => ({ ...prev, email: event.target.value }));
            setRegisterEmailTouched(true);
          }}
          onBlur={() => setRegisterEmailTouched(true)}
        />
      </label>
      {(registerEmailInvalid || registerEmailConflict) && (
        <p className="text-xs text-medical-red">
          {registerEmailConflict ? "An account already exists with this email." : "Please provide a valid work email."}
        </p>
      )}
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Password
        <div className="mt-2 flex items-center rounded-xl border border-slate-700 bg-slate-900/60 pr-2">
          <input
            type={showRegisterPassword ? "text" : "password"}
            required
            className="w-full rounded-xl bg-transparent p-3 text-sm text-slate-100 outline-none"
            value={registerPayload.password}
            onChange={(event) => setRegisterPayload((prev) => ({ ...prev, password: event.target.value }))}
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            aria-label={showRegisterPassword ? "Hide password" : "Show password"}
            className="text-slate-400 transition hover:text-slate-200"
            onClick={() => setShowRegisterPassword((prev) => !prev)}
          >
            {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Use 8+ characters with symbols & digits.</p>
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
          disabled={registerLoading || !canSubmitRegister}
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
