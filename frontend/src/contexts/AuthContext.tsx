import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { login as apiLogin, logout as apiLogout } from "../lib/api";

export type UserProfile = {
  _id: string;
  email: string;
  name: string;
  role: "coordinator" | "surgeon" | "admin" | "patient";
  created_at: string;
  patient_id?: string | null;
  phone_number?: string | null;
};

type AuthModalMode = "login" | "register";

interface AuthContextValue {
  token: string | null;
  email: string | null;
  user: UserProfile | null;
  login: (email: string, password: string, role: UserProfile["role"]) => Promise<UserProfile>;
  logout: () => void;
  openLogin: (reason?: string, mode?: AuthModalMode) => void;
  closeLogin: () => void;
  requireAuth: (reason?: string) => boolean;
  requireRole: (roles: Array<UserProfile["role"]>, reason?: string) => boolean;
  loginModal: { open: boolean; reason?: string; mode: AuthModalMode };
  authLoading: boolean;
  authError: string | null;
  pushMessage: (message: string) => void;
  bannerMessage: string | null;
  dismissMessage: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("liverlink_token"));
  const [email, setEmail] = useState<string | null>(localStorage.getItem("liverlink_user_email"));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem("liverlink_user");
    return stored ? (JSON.parse(stored) as UserProfile) : null;
  });
  const [loginModal, setLoginModal] = useState<{ open: boolean; reason?: string; mode: AuthModalMode }>({
    open: false,
    reason: undefined,
    mode: "login",
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const openLogin = useCallback((reason?: string, mode: AuthModalMode = "login") => {
    setLoginModal({ open: true, reason, mode });
    setAuthError(null);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginModal({ open: false, reason: undefined, mode: "login" });
    setAuthError(null);
  }, []);

  const pushMessage = useCallback((message: string) => {
    setBannerMessage(message);
  }, []);

  const dismissMessage = useCallback(() => {
    setBannerMessage(null);
  }, []);

  useEffect(() => {
    if (!bannerMessage) return;
    const timeout = window.setTimeout(() => setBannerMessage(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [bannerMessage]);

  const login = useCallback(
    async (userEmail: string, password: string, role: UserProfile["role"]) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const session = await apiLogin(userEmail, password, role);
        setToken(session.access_token);
        setEmail(userEmail);
        setUser(session.user);
        localStorage.setItem("liverlink_user_email", userEmail);
        localStorage.setItem("liverlink_user", JSON.stringify(session.user));
        pushMessage(session.message ?? "Login successful. Session unlocked.");
        closeLogin();
        return session.user;
      } catch (error: any) {
        const detail = error?.response?.data?.detail ?? "Invalid credentials";
        setAuthError(detail);
        pushMessage(detail);
        throw error;
      } finally {
        setAuthLoading(false);
      }
    },
    [closeLogin, pushMessage]
  );

  const logout = useCallback(() => {
    apiLogout();
    localStorage.removeItem("liverlink_user_email");
    localStorage.removeItem("liverlink_user");
    setToken(null);
    setEmail(null);
    setUser(null);
    pushMessage("You have been logged out.");
  }, [pushMessage]);

  const requireAuth = useCallback(
    (reason?: string) => {
      if (token) return true;
      openLogin(reason);
      return false;
    },
    [token, openLogin]
  );

  const requireRole = useCallback(
    (roles: Array<UserProfile["role"]>, reason?: string) => {
      if (!requireAuth(reason)) return false;
      if (!roles.length) return true;
      if (user && roles.includes(user.role)) {
        return true;
      }
      pushMessage("You do not have permission to view that area.");
      return false;
    },
    [requireAuth, user, pushMessage]
  );

  const value = useMemo(
    () => ({
      token,
      email,
      user,
      login,
      logout,
      openLogin,
      closeLogin,
      requireAuth,
      requireRole,
      loginModal,
      authLoading,
      authError,
      pushMessage,
      bannerMessage,
      dismissMessage,
    }),
    [
      token,
      email,
      user,
      login,
      logout,
      openLogin,
      closeLogin,
      requireAuth,
      requireRole,
      loginModal,
      authLoading,
      authError,
      pushMessage,
      bannerMessage,
      dismissMessage,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
