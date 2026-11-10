import type { MessageRole } from "../domain.js";

export type ConversationLine = { role: MessageRole; content: string };

export type QuestionInput = {
  seedWord: string;
  /** 지금까지의 대화 (오래된 순) */
  history: ConversationLine[];
};

export type AiTurn = {
  /** 질문 1개 (1~2문장, 물음표로 끝남) */
  question: string;
  /** 단어 선택지 0~3개 */
  choices: string[];
  /** 디버깅/지표용: 질문이 어디서 왔는지 */
  source: "gemini" | "fallback" | "mock";
};

/** 다음 질문을 만든다. 절대 throw하지 않는다 — 실패 시 미리 정해 둔 질문을 돌려준다. */
export interface Questioner {
  nextQuestion(input: QuestionInput): Promise<AiTurn>;
}
