import type { Session, Message } from "./types";

const BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  getAvailableSessions: (date: string) =>
    request<Session[]>(`/api/sessions/available?date=${date}`),
  getSession: (id: string) =>
    request<Session>(`/api/sessions/${id}`),
  register: (data: { session_id: string; name: string; email: string; phone: string }) =>
    request<any>("/api/registrations/", { method: "POST", body: JSON.stringify(data) }),
  validateToken: (sessionId: string, token: string) =>
    request<any>(`/api/registrations/validate?session_id=${sessionId}&token=${token}`),
  markAttended: (sessionId: string, token: string) =>
    request<any>("/api/registrations/attend", {
      method: "POST", body: JSON.stringify({ session_id: sessionId, token }),
    }),
  sendMessage: (sessionId: string, token: string, content: string) =>
    request<any>("/api/messages/", {
      method: "POST", body: JSON.stringify({ session_id: sessionId, token, content }),
    }),
  getMessages: (sessionId: string) =>
    request<Message[]>(`/api/messages/${sessionId}`),
  submitCTA: (sessionId: string, token: string, formData: Record<string, any>) =>
    request<any>("/api/admin/registrations/cta", {
      method: "POST", body: JSON.stringify({ session_id: sessionId, token, form_data: formData }),
    }),
};
