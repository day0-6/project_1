export type SessionStatus = "in_progress" | "completed";
export type MessageRole = "ai" | "user";
export type EventType = "session_started" | "diary_completed" | "session_resumed" | "draft_generated";
export type DraftSource = "ai" | "fallback";

export type Session = {
  id: string;
  user_id: string;
  seed_word: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

/** 대화 종료 시 만든 일기 초안. messages에 role='ai', kind='suggestion'으로 저장된다. */
export type Suggestion = {
  content: string;
  source: DraftSource;
  created_at: string;
};

export type Diary = {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type SessionSummary = Session & {
  answer_count: number;
  last_answer: string | null;
};

export type DiaryWithSeed = Diary & { seed_word: string };

/** 메인 화면에서 보여 주는 첫 질문. 앱과 문구를 맞춘다. */
export const OPENING_QUESTION = "오늘 가장 기억에 남는 단어 하나만 알려줄래?";
