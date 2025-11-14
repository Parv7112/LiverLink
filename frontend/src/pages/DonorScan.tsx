import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRScanner } from "../components/QRScanner";
import { useAuth } from "../contexts/AuthContext";
import { registerDonor, triggerAllocation } from "../lib/api";

const bloodTypes = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"];

function DonorScan() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const { token, email, requireAuth, openLogin, pushMessage } = useAuth();
  const [status, setStatus] = useState<string>(token ? "Scan donor QR to begin" : "Authenticate to begin scanning.");
  const [donorData, setDonorData] = useState({
    organ: "",
    blood_type: "",
    age: undefined as number | undefined,
    cause_of_death: "",
    crossmatch_score: undefined as number | undefined,
    procurement_hospital: "",
    arrival_eta_min: undefined as number | undefined,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStatus(token ? "Scan donor QR to begin" : "Authenticate to begin scanning.");
  }, [token]);

  const onScan = useCallback((value: string) => {
    let parsed: any = null;
    try {
      parsed = JSON.parse(value);
    } catch {
      // not JSON
    }
    if (parsed && typeof parsed === "object") {
      setDonorData({
        organ: parsed.organ ?? "",
        blood_type: parsed.blood_type ?? "",
        age: typeof parsed.age === "number" ? parsed.age : undefined,
        cause_of_death: parsed.cause_of_death ?? "",
        crossmatch_score: typeof parsed.crossmatch_score === "number" ? parsed.crossmatch_score : undefined,
        procurement_hospital: parsed.procurement_hospital ?? "",
        arrival_eta_min: typeof parsed.arrival_eta_min === "number" ? parsed.arrival_eta_min : undefined,
      });
      setQrCode(parsed.qr_code_id ?? value);
      setStatus("QR detected and donor profile pre-filled.");
    } else {
      setQrCode(value);
      setStatus(`QR detected: ${value}`);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!requireAuth("Please log in before registering a donor.")) {
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
        setStatus("Allocation initiated. Monitor AI Agent status.");
        pushMessage("Donor registered and allocation started.");
      } catch (error: any) {
        setStatus(error?.response?.data?.detail ?? "Unable to register donor.");
      } finally {
        setLoading(false);
      }
    },
    [qrCode, donorData, requireAuth, pushMessage]
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
