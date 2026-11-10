import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Diary, DiaryWithSeed, EventType, Message, MessageRole, Session, SessionStatus, SessionSummary } from "../domain.js";
import { SessionAlreadyCompletedError, type Authenticator, type Repository } from "./types.js";

const SessionRow = z.object({
  id: z.string(),
  user_id: z.string(),
  seed_word: z.string(),
  status: z.enum(["in_progress", "completed"]),
  created_at: z.string(),
  updated_at: z.string(),
});
const MessageRow = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(["ai", "user"]),
  content: z.string(),
  created_at: z.string(),
});
const DiaryRow = z.object({
  id: z.string(),
  session_id: z.string(),
  user_id: z.string(),
  content: z.string(),
  created_at: z.string(),
});
const SessionWithMessagesRow = SessionRow.extend({
  messages: z.array(MessageRow.pick({ role: true, content: true, created_at: true })),
});
const DiaryWithSessionRow = DiaryRow.extend({
  sessions: z.object({ seed_word: z.string() }).nullable(),
});

type PgError = { message: string; code?: string };

function fail(op: string, error: PgError): never {
  // 사용자 일기 내용이 로그에 남지 않도록 메시지/코드만 기록
  throw new Error(`[supabase] ${op} 실패: ${error.code ?? ""} ${error.message}`);
}

function toDiaryWithSeed(row: z.infer<typeof DiaryWithSessionRow>): DiaryWithSeed {
  const { sessions, ...diary } = row;
  return { ...diary, seed_word: sessions?.seed_word ?? "" };
}

export class SupabaseRepository implements Repository {
  constructor(private readonly db: SupabaseClient) {}

  async createSession(seedWord: string): Promise<Session> {
    const { data, error } = await this.db.from("sessions").insert({ seed_word: seedWord }).select().single();
    if (error) fail("createSession", error);
    return SessionRow.parse(data);
  }

  async getSession(id: string): Promise<Session | null> {
    const { data, error } = await this.db.from("sessions").select().eq("id", id).maybeSingle();
    if (error) fail("getSession", error);
    return data ? SessionRow.parse(data) : null;
  }

  async listSessions(status?: SessionStatus): Promise<SessionSummary[]> {
    let query = this.db
      .from("sessions")
      .select("*, messages(role, content, created_at)")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) fail("listSessions", error);
    return z.array(SessionWithMessagesRow).parse(data).map(({ messages, ...session }) => {
      const answers = messages
        .filter((m) => m.role === "user")
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        ...session,
        // 첫 user 메시지는 시작 단어이므로 답변 수에서 제외
        answer_count: Math.max(answers.length - 1, 0),
        last_answer: answers.length > 1 ? (answers[answers.length - 1]?.content ?? null) : null,
      };
    });
  }

  async addMessage(sessionId: string, role: MessageRole, content: string): Promise<Message> {
    const { data, error } = await this.db
      .from("messages")
      .insert({ session_id: sessionId, role, content })
      .select()
      .single();
    if (error) fail("addMessage", error);
    return MessageRow.parse(data);
  }

  async listMessages(sessionId: string): Promise<Message[]> {
    const { data, error } = await this.db
      .from("messages")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) fail("listMessages", error);
    return z.array(MessageRow).parse(data);
  }

  async completeSession(sessionId: string, content: string): Promise<Diary> {
    const { data, error } = await this.db.rpc("complete_session", {
      p_session_id: sessionId,
      p_content: content,
    });
    if (error) {
      if (error.message.includes("session_already_completed")) throw new SessionAlreadyCompletedError();
      fail("completeSession", error);
    }
    return DiaryRow.parse(data);
  }

  async listDiaries(): Promise<DiaryWithSeed[]> {
    const { data, error } = await this.db
      .from("diaries")
      .select("*, sessions(seed_word)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) fail("listDiaries", error);
    return z.array(DiaryWithSessionRow).parse(data).map(toDiaryWithSeed);
  }

  async getDiary(id: string): Promise<DiaryWithSeed | null> {
    const { data, error } = await this.db
      .from("diaries")
      .select("*, sessions(seed_word)")
      .eq("id", id)
      .maybeSingle();
    if (error) fail("getDiary", error);
    return data ? toDiaryWithSeed(DiaryWithSessionRow.parse(data)) : null;
  }

  async logEvent(type: EventType): Promise<void> {
    const { error } = await this.db.from("events").insert({ type });
    if (error) fail("logEvent", error);
  }
}

/**
 * 사용자 액세스 토큰을 Supabase Auth로 검증하고,
 * 같은 토큰을 실은 클라이언트로 Repository를 만든다 (RLS 적용).
 */
export function createSupabaseAuthenticator(url: string, anonKey: string): Authenticator {
  return async (accessToken) => {
    const db = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await db.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { userId: data.user.id, repo: new SupabaseRepository(db) };
  };
}
