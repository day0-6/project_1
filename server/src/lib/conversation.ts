import type { Message, Session } from "../domain.js";
import type { DraftInput } from "../ai/diaryDraft.js";
import type { QuestionInput } from "../ai/types.js";

/** 이 수만큼 답하면 앱이 "여기까지 할래"를 조금 더 권한다 (3~5턴 권장) */
export const SUGGEST_FINISH_AFTER = 3;

/** 시작 단어(첫 user 메시지)를 뺀 사용자 답변들 */
export function userAnswers(messages: Message[]): Message[] {
  return messages.filter((m) => m.role === "user").slice(1);
}

export function shouldSuggestFinish(messages: Message[]): boolean {
  return userAnswers(messages).length >= SUGGEST_FINISH_AFTER;
}

/** 일기 초안 입력: 시작 단어와 사용자 답변만. AI 질문은 넣지 않는다 (사용자가 한 말만으로 정리). */
export function toDraftInput(session: Session, messages: Message[]): DraftInput {
  return { seedWord: session.seed_word, answers: userAnswers(messages).map((m) => m.content) };
}

export function toQuestionInput(session: Session, messages: Message[]): QuestionInput {
  return {
    seedWord: session.seed_word,
    history: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}
