import { ApiError, kindFromStatus, messageFromBody } from "./apiError";
import { config } from "./config";
import { supabase } from "./supabase";
import type { Conversation, Diary, Session, SessionStatus, SessionSummary, Turn } from "./types";

const TIMEOUT_MS = 20000;

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("unauthorized", "다시 로그인해 주세요.", 401);
  return token;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = await accessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("network", "연결이 안 돼요.");
  } finally {
    clearTimeout(timer);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) await supabase.auth.signOut();
    throw new ApiError(kindFromStatus(res.status), messageFromBody(json) ?? "문제가 생겼어요.", res.status);
  }
  return json as T;
}

export const api = {
  startSession: (seedWord: string) => request<Conversation>("POST", "/sessions", { seedWord }),
  getSession: (id: string) => request<Omit<Conversation, "choices">>("GET", `/sessions/${id}`),
  resumeSession: (id: string) => request<Conversation>("POST", `/sessions/${id}/resume`),
  sendMessage: (id: string, content: string) => request<Turn>("POST", `/sessions/${id}/messages`, { content }),
  getDraft: (id: string) => request<{ seedWord: string; draft: string }>("GET", `/sessions/${id}/draft`),
  complete: (id: string, content: string) =>
    request<{ diary: Diary }>("POST", `/sessions/${id}/complete`, { content }),
  listSessions: (status?: SessionStatus) =>
    request<{ sessions: SessionSummary[] }>("GET", `/sessions${status ? `?status=${status}` : ""}`),
  listDiaries: () => request<{ diaries: Diary[] }>("GET", "/diaries"),
  getDiary: (id: string) => request<{ diary: Diary }>("GET", `/diaries/${id}`),
};

export type { Session };
