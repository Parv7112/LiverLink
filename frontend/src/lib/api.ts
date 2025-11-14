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
  role: z.enum(["coordinator", "surgeon", "admin"]),
  created_at: z.string(),
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
});

export async function registerAdmin(payload: z.infer<typeof RegisterSchema>) {
  const response = await apiClient.post("/auth/register", payload);
  return response.data;
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
