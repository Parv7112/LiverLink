import axios from "axios";
import { z } from "zod";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const apiClient = axios.create({
  baseURL: API_BASE,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("liverlink_token");
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

const UserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["coordinator", "surgeon", "admin", "patient"]),
  created_at: z.string(),
  patient_id: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
});

const AuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().default("bearer"),
  user: UserSchema,
  message: z.string().optional(),
});

export type AuthSession = z.infer<typeof AuthResponseSchema>;

export async function login(email: string, password: string, role: "coordinator" | "surgeon" | "admin") {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  form.append("role", role);
  const response = await apiClient.post("/auth/login", form);
  const data = AuthResponseSchema.parse(response.data);
  localStorage.setItem("liverlink_token", data.access_token);
  localStorage.setItem("liverlink_user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem("liverlink_token");
  localStorage.removeItem("liverlink_user");
}

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string(),
  role: z.string().default("surgeon"),
  phone_number: z.string().optional(),
});

export async function registerAdmin(payload: z.infer<typeof RegisterSchema>) {
  const response = await apiClient.post("/auth/register", payload);
  return response.data;
}

const PatientSchema = z.object({
  _id: z.string(),
  name: z.string(),
  phone_number: z.string().nullable().optional(),
  blood_type: z.string(),
  hla_match: z.number(),
  meld: z.number(),
  age: z.number(),
  comorbidities: z.number(),
  bilirubin: z.number(),
  inr: z.number(),
  creatinine: z.number(),
  ascites_grade: z.number(),
  encephalopathy_grade: z.number(),
  hospitalized_last_7d: z.number(),
  waitlist_days: z.number(),
  eta_min: z.number(),
  or_available: z.boolean(),
  survival_6hr_prob: z.number(),
  profile_verified: z.boolean().default(false),
});

export type PatientProfile = z.infer<typeof PatientSchema>;

export async function fetchMyPatientProfile() {
  const response = await apiClient.get("/patients/me/profile");
  return PatientSchema.parse(response.data);
}

export async function updatePatientProfile(patientId: string, payload: Omit<PatientProfile, "_id">) {
  const response = await apiClient.put(`/patients/${patientId}`, payload);
  return PatientSchema.parse(response.data);
}

const DonorSchema = z.object({
  qr_code_id: z.string(),
  organ: z.string(),
  blood_type: z.string(),
  age: z.number(),
  cause_of_death: z.string(),
  crossmatch_score: z.number(),
  procurement_hospital: z.string(),
  arrival_eta_min: z.number(),
  hla_a: z.string().optional(),
  hla_b: z.string().optional(),
  hla_drb1: z.string().optional(),
  donor_meld_context: z.number().optional(),
});

export async function registerDonor(payload: z.infer<typeof DonorSchema>) {
  const response = await apiClient.post("/donors/", payload);
  return response.data;
}

export async function triggerAllocation(qrCodeId: string, organ: string) {
  const response = await apiClient.post(`/donors/${qrCodeId}/allocate`, { organ });
  return response.data;
}

const AgentHistorySchema = z.object({
  history: z.array(z.record(z.any())),
});

export async function fetchAgentHistory() {
  const response = await apiClient.get("/agent/history");
  return AgentHistorySchema.parse(response.data);
}

export async function contactPatient(qrCodeId: string, patientId: string, message: string) {
  const response = await apiClient.post(`/donors/${qrCodeId}/contact-patient`, {
    patient_id: patientId,
    donor_qr_code_id: qrCodeId,
    message,
  });
  return response.data;
}

export async function acceptAllocation(qrCodeId: string, patientId: string, allocationId: string) {
  const response = await apiClient.post(`/donors/${qrCodeId}/accept-allocation`, {
    patient_id: patientId,
    allocation_id: allocationId,
  });
  return response.data;
}
