import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchMyPatientProfile, PatientProfile, updatePatientProfile } from "../lib/api";

type EditableField = keyof Omit<PatientProfile, "_id" | "profile_verified">;

const numericFields: EditableField[] = [
  "meld",
  "hla_match",
  "age",
  "comorbidities",
  "bilirubin",
  "inr",
  "creatinine",
  "ascites_grade",
  "encephalopathy_grade",
  "hospitalized_last_7d",
  "waitlist_days",
  "eta_min",
  "survival_6hr_prob",
];

const fieldConfig: Array<{
  name: EditableField;
  label: string;
  type: "text" | "number" | "select";
  step?: string;
}> = [
  { name: "name", label: "Name", type: "text" },
  { name: "phone_number", label: "Mobile Number", type: "text" },
  { name: "blood_type", label: "Blood Type", type: "text" },
  { name: "meld", label: "MELD Score", type: "number", step: "1" },
  { name: "hla_match", label: "HLA Match (%)", type: "number", step: "1" },
  { name: "age", label: "Age", type: "number", step: "1" },
  { name: "comorbidities", label: "Comorbidities", type: "number", step: "1" },
  { name: "bilirubin", label: "Bilirubin", type: "number", step: "0.01" },
  { name: "inr", label: "INR", type: "number", step: "0.01" },
  { name: "creatinine", label: "Creatinine", type: "number", step: "0.01" },
  { name: "ascites_grade", label: "Ascites Grade", type: "number", step: "1" },
  { name: "encephalopathy_grade", label: "Encephalopathy Grade", type: "number", step: "1" },
  { name: "hospitalized_last_7d", label: "Hospitalized (Last 7d)", type: "number", step: "1" },
  { name: "waitlist_days", label: "Waitlist Days", type: "number", step: "1" },
  { name: "eta_min", label: "OR ETA (min)", type: "number", step: "1" },
  { name: "survival_6hr_prob", label: "Survival 6hr Prob", type: "number", step: "0.01" },
  { name: "or_available", label: "OR Available", type: "select" },
];

export default function PatientDashboard() {
  const { user, logout, openLogin } = useAuth();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState<Record<EditableField, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const formInputClasses =
    "mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-base text-white placeholder:text-slate-500";
  const formSelectClasses = `${formInputClasses} pr-8`;
  const formLabelClasses = "text-sm font-semibold text-slate-300";

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchMyPatientProfile();
        setProfile(data);
        setFormState(buildFormState(data));
        setShowModal(!data.profile_verified);
      } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail ?? "Unable to load patient profile.";
        if (status === 401) {
          await logout();
          openLogin("Session expired. Please log in again.", "login");
        }
        setError(detail);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [logout, openLogin]);

  const buildFormState = (data: PatientProfile): Record<EditableField, string> => {
    const entries: [EditableField, string][] = fieldConfig.map((field) => {
      const raw = data[field.name];
      if (!data.profile_verified) {
        if (typeof raw === "boolean") {
          return [field.name, raw ? "true" : "false"];
        }
        return [field.name, ""];
      }
      if (typeof raw === "boolean") {
        return [field.name, raw ? "true" : "false"];
      }
      return [field.name, raw?.toString() ?? ""];
    });
    return Object.fromEntries(entries) as Record<EditableField, string>;
  };

  const handleFieldChange = (field: EditableField, raw: string) => {
    setFormState((prev) => (prev ? { ...prev, [field]: raw } : prev));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !formState) return;
    setSaving(true);
    try {
      const payload = fieldConfig.reduce((acc, config) => {
        const value = formState[config.name] ?? "";
        if (config.type === "select") {
          acc[config.name] = value === "true";
        } else if (config.type === "number") {
          acc[config.name] = Number(value || 0);
        } else {
          acc[config.name] = value;
        }
        return acc;
      }, {} as Record<EditableField, string | number | boolean>);

      const updated = await updatePatientProfile(profile._id, payload as any);
      setProfile(updated);
      setFormState(buildFormState(updated));
      setShowModal(!updated.profile_verified);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail ?? "Unable to update profile.";
      if (status === 401) {
        await logout();
        openLogin("Session expired. Please log in again.", "login");
      }
      setError(detail);
    } finally {
      setSaving(false);
    }
  };

  const cards = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "Blood Type", value: profile.blood_type },
      { label: "MELD Score", value: profile.meld },
      { label: "HLA Match", value: `${profile.hla_match}%` },
      { label: "Mobile", value: profile.phone_number ?? "—" },
      { label: "Waitlist Days", value: profile.waitlist_days },
      { label: "ETA (min)", value: profile.eta_min },
      { label: "Survival 6hr", value: `${Math.round(profile.survival_6hr_prob * 100)}%` },
    ];
  }, [profile]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-slate-300">
        Loading patient dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] rounded-3xl border border-medical-red/40 bg-medical-red/10 p-8 text-medical-red">
        <p>{error}</p>
        <button
          className="mt-4 rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-200 hover:border-slate-500"
          onClick={() => openLogin("Please log in to continue.", "login")}
        >
          Log In
        </button>
      </div>
    );
  }

  if (!profile || !formState) {
    return null;
  }

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Patient Dashboard</p>
        <h1 className="text-3xl font-bold text-white">Welcome back, {user?.name ?? profile.name}</h1>
        <p className="text-sm text-slate-400">Keep your clinical information current so the care team can respond fast.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Clinical Snapshot</p>
            <h2 className="text-2xl font-semibold text-white">{profile.name}</h2>
            <p className="text-sm text-slate-400">ID {profile._id} • Blood {profile.blood_type}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-full border border-slate-700 px-5 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-200 hover:border-slate-500"
          >
            Edit Details
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <p className="text-slate-500">Comorbidities</p>
            <p className="text-white">{profile.comorbidities}</p>
          </div>
          <div>
            <p className="text-slate-500">Bilirubin</p>
            <p className="text-white">{profile.bilirubin}</p>
          </div>
          <div>
            <p className="text-slate-500">INR</p>
            <p className="text-white">{profile.inr}</p>
          </div>
        </div>
      </section>

      {showModal && formState && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-start justify-center bg-slate-950/90 px-4 pb-10 pt-8 md:pb-14 md:pt-10 backdrop-blur top-[40px] md:top-[60px]">
          <motion.form
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="max-h-[85vh] w-full max-w-4xl space-y-6 overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950/90 p-10 pb-12 text-slate-100 shadow-[0_35px_150px_rgba(2,6,23,0.85)]"
          >
            <header className="sticky top-0 z-10 space-y-2 rounded-2xl bg-slate-950/95 p-1 pb-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Profile verification</p>
              <h2 className="text-3xl font-bold text-white">Confirm your clinical details</h2>
              <p className="text-sm text-slate-400">Review and update your information. This form must be submitted to continue.</p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              {fieldConfig.map((field) => {
                const value = formState[field.name] ?? "";
                if (field.type === "select") {
                  return (
                    <label key={field.name} className={formLabelClasses}>
                      {field.label}
                      <select
                        className={formSelectClasses}
                        value={value}
                        onChange={(event) => handleFieldChange(field.name, event.target.value)}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  );
                }
                return (
                  <label key={field.name} className={formLabelClasses}>
                    {field.label}
                    <input
                      type={field.type}
                      step={field.step}
                      className={`${formInputClasses} outline-none focus:border-medical-blue/60 focus:ring-2 focus:ring-medical-blue/20`}
                        value={value}
                      onChange={(event) => handleFieldChange(field.name, event.target.value)}
                      required
                    />
                  </label>
                );
              })}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-full bg-medical-blue px-6 py-3 text-sm font-semibold uppercase tracking-[0.45em] text-white shadow-lg shadow-medical-blue/35 transition hover:bg-medical-blue/85 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </motion.form>
        </div>
      )}
    </div>
  );
}
