import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRScanner } from "../components/QRScanner";
import { useAuth } from "../contexts/AuthContext";
import { registerDonor, triggerAllocation } from "../lib/api";

const bloodTypes = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];

type DonorFormState = {
  organ: string;
  blood_type: string;
  age: number | undefined;
  cause_of_death: string;
  crossmatch_score: number | undefined;
  procurement_hospital: string;
  arrival_eta_min: number | undefined;
  hla_a?: string;
  hla_b?: string;
  hla_drb1?: string;
  donor_meld_context?: number | undefined;
};

const emptyDonorState: DonorFormState = {
  organ: "",
  blood_type: "",
  age: undefined,
  cause_of_death: "",
  crossmatch_score: undefined,
  procurement_hospital: "",
  arrival_eta_min: undefined,
  hla_a: "",
  hla_b: "",
  hla_drb1: "",
  donor_meld_context: undefined,
};

type ParsedDonorPayload = {
  qrCodeId?: string;
  donor?: Partial<DonorFormState>;
};

const numericOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const cleanString = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
};

const normaliseFields = (record: Record<string, any>): ParsedDonorPayload => {
  const alias = (keys: string[]): any => {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) {
        return record[key];
      }
    }
    return undefined;
  };

  const donor: Partial<DonorFormState> = {
    organ: cleanString(alias(["organ", "organ_type", "o"])),
    blood_type: cleanString(alias(["blood_type", "bloodType", "blood", "bt"])),
    age: numericOrUndefined(alias(["age", "donor_age"])),
    cause_of_death: cleanString(alias(["cause_of_death", "cod", "cause"])),
    crossmatch_score: numericOrUndefined(alias(["crossmatch_score", "crossmatch", "cm_score"])),
    procurement_hospital: cleanString(alias(["procurement_hospital", "hospital", "facility"])),
    arrival_eta_min: numericOrUndefined(alias(["arrival_eta_min", "eta", "arrival_eta"])),
    hla_a: cleanString(alias(["hla_a", "hla_A", "hlaA", "HLA_A"])),
    hla_b: cleanString(alias(["hla_b", "hla_B", "hlaB", "HLA_B"])),
    hla_drb1: cleanString(alias(["hla_drb1", "hla_DRB1", "hlaDRB1", "HLA_DRB1"])),
    donor_meld_context: numericOrUndefined(alias(["donor_meld_context", "meld_context", "meld"])),
  };

  const qrCodeId = cleanString(
    alias(["qr_code_id", "qr", "qr_code", "qrCodeId", "wristband", "code", "id"])
  );

  const hasUsefulField = qrCodeId || Object.values(donor).some((value) => value !== "" && value !== undefined);

  return hasUsefulField ? { qrCodeId: qrCodeId || undefined, donor } : {};
};

const parseKeyValuePairs = (raw: string): Record<string, string> => {
  const map: Record<string, string> = {};
  raw
    .split(/[\r\n;,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [key, ...rest] = entry.split(/[:=]/);
      if (key && rest.length) {
        map[key.trim()] = rest.join(":=").trim();
      }
    });
  return map;
};

const decodeBase64 = (value: string): string | null => {
  try {
    return atob(value);
  } catch {
    try {
      return atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return null;
    }
  }
};

const parseDonorPayload = (raw: string): ParsedDonorPayload => {
  const attempts: Array<Record<string, any>> = [];
  const trimmed = raw.trim();

  const tryJson = (input: string) => {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object") {
        attempts.push(parsed as Record<string, any>);
      }
    } catch {
      // ignore
    }
  };

  tryJson(trimmed);
  const base64Decoded = decodeBase64(trimmed);
  if (base64Decoded) {
    tryJson(base64Decoded);
  }

  if (trimmed.includes("=")) {
    try {
      const qp = trimmed.includes("?") ? trimmed.split("?").pop() ?? trimmed : trimmed;
      const params = new URLSearchParams(qp);
      const record: Record<string, string> = {};
      params.forEach((value, key) => {
        record[key] = value;
      });
      if (Object.keys(record).length > 0) {
        attempts.push(record);
      }
    } catch {
      // ignore
    }
  }

  const kv = parseKeyValuePairs(trimmed);
  if (Object.keys(kv).length > 0) {
    attempts.push(kv);
  }

  for (const candidate of attempts) {
    const result = normaliseFields(candidate);
    if (result.qrCodeId || result.donor) {
      return result;
    }
  }

  return {};
};

function DonorScan() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const { token, email, requireAuth, requireRole, openLogin, pushMessage } = useAuth();
  const [status, setStatus] = useState<string>(token ? "Scan donor QR to begin" : "Authenticate to begin scanning.");
  const [donorData, setDonorData] = useState<DonorFormState>(emptyDonorState);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setStatus(token ? "Scan donor QR to begin" : "Authenticate to begin scanning.");
  }, [token]);

  const onScan = useCallback((value: string) => {
    const parsed = parseDonorPayload(value);
    if (parsed.donor) {
        setDonorData((prev) => ({
          ...prev,
          ...parsed.donor,
        }));
    }
    if (parsed.qrCodeId) {
      setQrCode(parsed.qrCodeId);
      setStatus("QR detected and donor profile pre-filled.");
    } else {
      setQrCode(value);
      setStatus("QR captured but we could not read metadata. Please verify fields manually.");
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!requireAuth("Please log in before registering a donor.")) {
        return;
      }
      if (!requireRole(["coordinator"], "Coordinator access required for donor intake.")) {
        return;
      }
      if (!qrCode) {
        setStatus("Please scan a donor wristband first.");
        return;
      }
      setLoading(true);
      try {
        await registerDonor({ qr_code_id: qrCode, ...donorData });
        setStatus("Donor registered. Triggering AI allocation...");
        await triggerAllocation(qrCode, donorData.organ);
        setStatus("Allocation initiated. Redirecting to Agent Log...");
        pushMessage("Donor registered and allocation started.");
        navigate("/agent-log");
      } catch (error: any) {
        setStatus(error?.response?.data?.detail ?? "Unable to register donor.");
      } finally {
        setLoading(false);
      }
    },
    [qrCode, donorData, requireAuth, pushMessage, navigate]
  );

  const hospitalOptions = useMemo(
    () => ["Bayview Medical", "St. Anne", "Riverfront", "Harborview"],
    []
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-10 lg:grid-cols-2">
        <QRScanner onScan={onScan} />
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-8"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Donor Profile</p>
            <p className="text-xs text-slate-500">
              AI auto-fills labs once registered. Adjust values if required.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Blood Type
              <select
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                value={donorData.blood_type || ""}
                onChange={(event) => setDonorData((prev) => ({ ...prev, blood_type: event.target.value }))}
              >
                <option value="" disabled>
                  Select blood type
                </option>
                {bloodTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Organ
              <select
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                value={donorData.organ || ""}
                onChange={(event) => setDonorData((prev) => ({ ...prev, organ: event.target.value }))}
              >
                <option value="" disabled>
                  Select organ
                </option>
                <option value="liver">Liver</option>
                <option value="kidney">Kidney</option>
                <option value="heart">Heart</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Donor Age
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                value={donorData.age}
                onChange={(event) => setDonorData((prev) => ({ ...prev, age: Number(event.target.value) }))}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Crossmatch Score
              <input
                type="number"
                max={100}
                min={0}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                value={donorData.crossmatch_score}
                onChange={(event) => setDonorData((prev) => ({ ...prev, crossmatch_score: Number(event.target.value) }))}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 md:col-span-2">
              Cause of Death
              <input
                type="text"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                value={donorData.cause_of_death}
                onChange={(event) => setDonorData((prev) => ({ ...prev, cause_of_death: event.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 md:col-span-2">
              Procurement Hospital
              <select
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                value={donorData.procurement_hospital || ""}
                onChange={(event) => setDonorData((prev) => ({ ...prev, procurement_hospital: event.target.value }))}
              >
                <option value="" disabled>
                  Select hospital
                </option>
                {hospitalOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Arrival ETA (min)
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                value={donorData.arrival_eta_min}
                onChange={(event) => setDonorData((prev) => ({ ...prev, arrival_eta_min: Number(event.target.value) }))}
              />
            </label>
          </div>
          
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-3">HLA Typing (Optional)</p>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                HLA-A
                <input
                  type="text"
                  placeholder="e.g., A*02:01"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={donorData.hla_a || ""}
                  onChange={(event) => setDonorData((prev) => ({ ...prev, hla_a: event.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                HLA-B
                <input
                  type="text"
                  placeholder="e.g., B*07:02"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={donorData.hla_b || ""}
                  onChange={(event) => setDonorData((prev) => ({ ...prev, hla_b: event.target.value }))}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                HLA-DRB1
                <input
                  type="text"
                  placeholder="e.g., DRB1*15:01"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100"
                  value={donorData.hla_drb1 || ""}
                  onChange={(event) => setDonorData((prev) => ({ ...prev, hla_drb1: event.target.value }))}
                />
              </label>
            </div>
          </div>
          <motion.button
            type="submit"
            className="w-full rounded-full bg-medical-blue px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-medical-blue/20 transition hover:bg-medical-blue/80 disabled:opacity-60"
            whileTap={{ scale: 0.98 }}
            disabled={loading}
          >
            {loading ? "Allocating..." : "Register & Allocate"}
          </motion.button>
          <p className="text-xs text-slate-500">{status}</p>
        </form>
      </div>
      {!token && (
        <button
          onClick={() => openLogin("Please log in to unlock donor intake.")}
          className="w-full rounded-3xl border border-dashed border-medical-blue/40 bg-medical-blue/5 p-4 text-sm font-semibold text-medical-blue transition hover:border-medical-blue/80"
        >
          Session inactive — tap to log in
        </button>
      )}
    </div>
  );
}

export default DonorScan;
