import type { Message, Session } from "../domain.js";
import type { DraftInput } from "../ai/diaryDraft.js";
import type { QuestionInput } from "../ai/types.js";

/** 이 수만큼 답하면 앱이 "여기까지 할래"를 조금 더 권한다 (3~5턴 권장) */
export const SUGGEST_FINISH_AFTER = 3;

/** "그만"류 앞에 붙어도 되는 말 */
const STOP_PREFIX = /^(이제|그냥|아니|아|제발|좀|질문)+/;
/** 답 전체가 이것뿐일 때만 그만하자는 뜻으로 본다 ("그만두고 싶었어", "끝나고 갔어"는 일기 내용) */
const STOP_CORE = /^(그만|됐어|됐다|됐고|끝|여기까지|스톱|stop)(해|해줘|해라|하라고|하라니까|할래|하자|해요|할게|하고싶어|낼래|내자|이야|요|물어|물어봐|물어봐라|좀|좀해)?$/i;

/** 사용자가 대화를 그만하자고 했는가. 그러면 질문하지 않고 바로 다듬기로 넘어간다. */
export function isStopRequest(text: string): boolean {
  const bare = text.replace(/[^\p{L}\p{N}]/gu, "").replace(/[ㄱ-ㅎㅏ-ㅣ]/g, "").toLowerCase();
  if (bare.length === 0 || bare.length > 20) return false;
  const core = bare.replace(STOP_PREFIX, "");
  return STOP_CORE.test(core);
}

/** 시작 단어(첫 user 메시지)를 뺀 사용자 답변들 */
export function userAnswers(messages: Message[]): Message[] {
  return messages.filter((m) => m.role === "user").slice(1);
}

export function shouldSuggestFinish(messages: Message[]): boolean {
  return userAnswers(messages).length >= SUGGEST_FINISH_AFTER;
}

/** 일기 초안 입력: 시작 단어와 사용자 답변만. AI 질문은 넣지 않는다 (사용자가 한 말만으로 정리). */
export function toDraftInput(session: Session, messages: Message[]): DraftInput {
  const answers = userAnswers(messages)
    .map((m) => m.content)
    .filter((a) => !isStopRequest(a)); // "이제 그만해"는 일기 내용이 아니다
  return { seedWord: session.seed_word, answers };
}

export function toQuestionInput(session: Session, messages: Message[]): QuestionInput {
  return {
    seedWord: session.seed_word,
    history: messages.map((m) => ({ role: m.role, content: m.content })),
  };
}
