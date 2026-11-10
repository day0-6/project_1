// 서버 응답 타입 (server/src/domain.ts와 맞춘다)
export type SessionStatus = "in_progress" | "completed";

export type Session = {
  id: string;
  seed_word: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  session_id: string;
  role: "ai" | "user";
  content: string;
  created_at: string;
};

export type SessionSummary = Session & { answer_count: number; last_answer: string | null };

export type Diary = {
  id: string;
  session_id: string;
  content: string;
  created_at: string;
  seed_word: string;
};

export type Conversation = {
  session: Session;
  messages: Message[];
  choices: string[];
  suggestFinish: boolean;
};

export type Turn = {
  userMessage: Message;
  aiMessage: Message;
  choices: string[];
  suggestFinish: boolean;
};
