import type { Diary, DiaryWithSeed, DraftSource, EventType, Message, MessageRole, Session, SessionStatus, SessionSummary, Suggestion } from "../domain.js";

/**
 * 한 사용자로 범위가 고정된 데이터 접근 계층.
 * Supabase 구현은 사용자 토큰으로 접속하므로 RLS가 소유권을 보장한다.
 */
export interface Repository {
  createSession(seedWord: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  listSessions(status?: SessionStatus): Promise<SessionSummary[]>;
  addMessage(sessionId: string, role: MessageRole, content: string): Promise<Message>;
  /** 대화 메시지만 (kind='chat'). 일기 초안은 빠진다. */
  listMessages(sessionId: string): Promise<Message[]>;
  addSuggestion(sessionId: string, content: string, source: DraftSource): Promise<Suggestion>;
  latestSuggestion(sessionId: string): Promise<Suggestion | null>;
  /** 일기 저장 + completed 전환 + 이벤트 기록을 원자적으로 수행 */
  completeSession(sessionId: string, content: string): Promise<Diary>;
  listDiaries(): Promise<DiaryWithSeed[]>;
  getDiary(id: string): Promise<DiaryWithSeed | null>;
  /** source는 draft_generated에만 쓴다 */
  logEvent(type: EventType, source?: DraftSource): Promise<void>;
}

export type AuthedContext = { userId: string; repo: Repository };

/** 액세스 토큰을 검증하고 사용자 범위 Repository를 돌려준다. 유효하지 않으면 null. */
export type Authenticator = (accessToken: string) => Promise<AuthedContext | null>;

export class SessionAlreadyCompletedError extends Error {
  constructor() {
    super("session_already_completed");
  }
}
