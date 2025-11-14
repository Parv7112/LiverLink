import { motion } from "framer-motion";
import { Lock, ShieldAlert } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { useAuth, UserProfile } from "../contexts/AuthContext";

type Props = {
  children: ReactNode;
  allowedRoles?: Array<UserProfile["role"]>;
  reason?: string;
};

export function RouteGuard({ children, allowedRoles = [], reason }: Props) {
  const { token, user, openLogin } = useAuth();

  useEffect(() => {
    if (!token) {
      openLogin(reason ?? "Please log in to continue.");
    }
  }, [token, openLogin, reason]);

  if (!token) {
    return (
      <GuardPanel
        icon={<Lock className="h-5 w-5" />}
        title="Authentication required"
        description={reason ?? "Log in to access this workflow."}
        actionLabel="Admin Login"
        onAction={() => openLogin(reason)}
      />
    );
  }

  if (allowedRoles.length && user && !allowedRoles.includes(user.role)) {
    return (
      <GuardPanel
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Insufficient permissions"
        description="This area is limited to coordinator accounts."
      />
    );
  }

  return <>{children}</>;
}

function GuardPanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/70 p-8 text-center text-slate-300"
      initial={{ opacity: 0.6, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-medical-blue/20 text-medical-blue">
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-full bg-medical-blue px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

