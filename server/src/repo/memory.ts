/**
 * 메모리 저장소 — 테스트와 로컬 데모(scripts/demo.ts) 전용. 운영 서버(src/index.ts)에서는 쓰지 않는다.
 */
import { randomUUID } from "node:crypto";
import type { Diary, DiaryWithSeed, DraftSource, EventType, Message, MessageRole, Session, SessionStatus, SessionSummary, Suggestion } from "../domain.js";
import { SessionAlreadyCompletedError, type Authenticator, type Repository } from "./types.js";

/** 테스트용 저장소. 사용자별로 걸러서 RLS를 흉내 낸다. */
export class MemoryStore {
  sessions: Session[] = [];
  messages: Message[] = [];
  suggestions: (Suggestion & { session_id: string })[] = [];
  diaries: Diary[] = [];
  events: { user_id: string; type: EventType; source?: DraftSource }[] = [];
  private clock = Date.parse("2026-11-10T00:00:00Z");
  private realTime = false;
  now(): string {
    this.clock = this.realTime ? Math.max(Date.now(), this.clock + 1) : this.clock + 1000;
    return new Date(this.clock).toISOString();
  }
  /** 데모 서버용: 시드를 넣은 뒤부터는 실제 시각을 쓴다. */
  useRealTime(): void {
    this.realTime = true;
  }
}

export class MemoryRepository implements Repository {
  constructor(
    private readonly store: MemoryStore,
    private readonly userId: string,
  ) {}

  private own(sessionId: string): Session | undefined {
    return this.store.sessions.find((s) => s.id === sessionId && s.user_id === this.userId);
  }

  async createSession(seedWord: string): Promise<Session> {
    const now = this.store.now();
    const s: Session = { id: randomUUID(), user_id: this.userId, seed_word: seedWord, status: "in_progress", created_at: now, updated_at: now };
    this.store.sessions.push(s);
    return { ...s };
  }
  async getSession(id: string) {
    const s = this.own(id);
    return s ? { ...s } : null;
  }
  async listSessions(status?: SessionStatus): Promise<SessionSummary[]> {
    return this.store.sessions
      .filter((s) => s.user_id === this.userId && (!status || s.status === status))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((s) => {
        const answers = this.store.messages.filter((m) => m.session_id === s.id && m.role === "user");
        return { ...s, answer_count: Math.max(answers.length - 1, 0), last_answer: answers.length > 1 ? (answers.at(-1)?.content ?? null) : null };
      });
  }
  async addMessage(sessionId: string, role: MessageRole, content: string): Promise<Message> {
    const s = this.own(sessionId);
    if (!s) throw new Error("rls violation");
    const m: Message = { id: randomUUID(), session_id: sessionId, role, content, created_at: this.store.now() };
    s.updated_at = m.created_at;
    this.store.messages.push(m);
    return { ...m };
  }
  async listMessages(sessionId: string) {
    return this.own(sessionId) ? this.store.messages.filter((m) => m.session_id === sessionId).map((m) => ({ ...m })) : [];
  }
  async addSuggestion(sessionId: string, content: string, source: DraftSource): Promise<Suggestion> {
    const s = this.own(sessionId);
    if (!s) throw new Error("rls violation");
    const suggestion = { session_id: sessionId, content, source, created_at: this.store.now() };
    s.updated_at = suggestion.created_at;
    this.store.suggestions.push(suggestion);
    return { content, source, created_at: suggestion.created_at };
  }
  async latestSuggestion(sessionId: string): Promise<Suggestion | null> {
    if (!this.own(sessionId)) return null;
    const last = this.store.suggestions.filter((x) => x.session_id === sessionId).at(-1);
    return last ? { content: last.content, source: last.source, created_at: last.created_at } : null;
  }
  async completeSession(sessionId: string, content: string): Promise<Diary> {
    const s = this.own(sessionId);
    if (!s) throw new Error("session_not_found");
    if (s.status === "completed") throw new SessionAlreadyCompletedError();
    const d: Diary = { id: randomUUID(), session_id: sessionId, user_id: this.userId, content, created_at: this.store.now() };
    this.store.diaries.push(d);
    s.status = "completed";
    this.store.events.push({ user_id: this.userId, type: "diary_completed" });
    return { ...d };
  }
  private withSeed(d: Diary): DiaryWithSeed {
    return { ...d, seed_word: this.store.sessions.find((s) => s.id === d.session_id)?.seed_word ?? "" };
  }
  async listDiaries() {
    return this.store.diaries
      .filter((d) => d.user_id === this.userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((d) => this.withSeed(d));
  }
  async getDiary(id: string) {
    const d = this.store.diaries.find((x) => x.id === id && x.user_id === this.userId);
    return d ? this.withSeed(d) : null;
  }
  async logEvent(type: EventType, source?: DraftSource) {
    this.store.events.push({ user_id: this.userId, type, ...(source ? { source } : {}) });
  }
}

/** "token-<userId>" 형식 토큰만 통과시키는 가짜 인증 */
export function memoryAuthenticator(store: MemoryStore): Authenticator {
  return async (token) => {
    const m = /^token-(.+)$/.exec(token);
    if (!m?.[1]) return null;
    return { userId: m[1], repo: new MemoryRepository(store, m[1]) };
  };
}
