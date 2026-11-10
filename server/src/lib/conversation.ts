import type { Message, Session } from "../domain.js";
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

/**
 * 다듬기 화면 초안: 사용자가 보낸 답변을 순서대로 이어 붙인다. AI는 쓰지 않는다.
 * 답변이 하나도 없으면 시작 단어로 시작한다 (빈 화면 금지).
 */
export function buildDraft(session: Session, messages: Message[]): string {
  const answers = userAnswers(messages).map((m) => m.content.trim()).filter(Boolean);
  return answers.length > 0 ? answers.join("\n") : session.seed_word;
}

export function toQuestionInput(session: Session, messages: Message[]): QuestionInput {
  return {
    seedWord: session.seed_word,
    history: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}
