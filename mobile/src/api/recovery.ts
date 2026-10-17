import { api } from "./client";
export interface Appeal {
  id: string;
  message: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "STALE";
  response: string | null;
  createdAt: string;
}
export const recoveryApi = {
  forgot: (email: string, language: "en" | "my") =>
    api<{ requestId: string }>("/auth/forgot-password", {
      method: "POST",
      body: { email, language },
      auth: false,
    }),
  reset: (requestId: string, code: string, newPassword: string) =>
    api<void>("/auth/reset-password", {
      method: "POST",
      body: { requestId, code, newPassword },
      auth: false,
    }),
  appeal: (email: string, password: string, message: string) =>
    api<{ appeal: Appeal }>("/auth/appeals", {
      method: "POST",
      body: { email, password, message },
      auth: false,
    }),
  status: (email: string, password: string) =>
    api<{ status: string; bannedReason: string | null; appeal: Appeal | null }>(
      "/auth/appeals/status",
      { method: "POST", body: { email, password }, auth: false },
    ),
};
