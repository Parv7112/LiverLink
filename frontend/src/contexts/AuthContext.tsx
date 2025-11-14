import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { login as apiLogin, logout as apiLogout } from "../lib/api";

interface AuthContextValue {
  token: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  openLogin: (reason?: string) => void;
  closeLogin: () => void;
  requireAuth: (reason?: string) => boolean;
  loginModal: { open: boolean; reason?: string };
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
  const [loginModal, setLoginModal] = useState<{ open: boolean; reason?: string }>({ open: false });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const openLogin = useCallback((reason?: string) => {
    setLoginModal({ open: true, reason });
    setAuthError(null);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginModal({ open: false });
    setAuthError(null);
  }, []);

  const pushMessage = useCallback((message: string) => {
    setBannerMessage(message);
  }, []);

  const dismissMessage = useCallback(() => {
    setBannerMessage(null);
  }, []);

  const login = useCallback(
    async (userEmail: string, password: string) => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const accessToken = await apiLogin(userEmail, password);
        setToken(accessToken);
        setEmail(userEmail);
        localStorage.setItem("liverlink_user_email", userEmail);
        pushMessage("Login successful. Session unlocked.");
        closeLogin();
      } catch (error: any) {
        setAuthError(error?.response?.data?.detail ?? "Invalid credentials");
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
    setToken(null);
    setEmail(null);
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

  const value = useMemo(
    () => ({
      token,
      email,
      login,
      logout,
      openLogin,
      closeLogin,
      requireAuth,
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
      login,
      logout,
      openLogin,
      closeLogin,
      requireAuth,
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
