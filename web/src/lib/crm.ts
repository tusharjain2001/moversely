import { API_URL } from "./api";
import type { MoveDetails } from "./move";

/** Chat, leads and admin calls to the AI server (see ai/survey/crm.py). */

export type ChatOption = { label: string; value: string };

export type ChatWidget =
  | { type: "chips"; options: ChatOption[] }
  | { type: "date"; min: string }
  | { type: "text"; input: "text" | "email" | "tel"; placeholder: string }
  | { type: "summary"; move: MoveDetails };

export type ChatMessage = { role: "user" | "assistant"; text: string };

export type ChatReply = {
  conversation_id: string;
  messages: ChatMessage[];
  widget: ChatWidget;
  lead_id: string | null;
};

async function call<T>(path: string, init?: RequestInit & { password?: string }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.password) headers["X-Admin-Password"] = init.password;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw Object.assign(new Error(detail), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export const chatSend = (body: { conversation_id?: string; text?: string; value?: string }) =>
  call<ChatReply>("/chat", { method: "POST", body: JSON.stringify(body) });

export const chatGet = (id: string) => call<ChatReply>(`/chat/${id}`);

export const saveLead = (move: MoveDetails) =>
  call<{ lead_id: string }>("/leads", { method: "POST", body: JSON.stringify({ ...move, lead_id: move.leadId }) });

export const saveSurvey = (leadId: string, items: number, volumeFt3: number) =>
  call<{ ok: boolean }>(`/leads/${leadId}/survey`, {
    method: "POST",
    body: JSON.stringify({ items, volume_ft3: volumeFt3 }),
  });

export type Lead = {
  id: string;
  created_at: string;
  source: "form" | "chat";
  name: string | null;
  email: string | null;
  phone: string | null;
  from_country: string | null;
  to_country: string | null;
  move_date: string | null;
  move_type: string | null;
  extras: Record<string, string> | null;
  conversation_id: string | null;
  survey_items: number | null;
  survey_volume_ft3: number | null;
  survey_updated_at: string | null;
  messages?: (ChatMessage & { created_at: string })[];
};

export const adminLeads = (password: string) => call<Lead[]>("/admin/leads", { password });

export const adminLead = (password: string, id: string) => call<Lead>(`/admin/leads/${id}`, { password });
