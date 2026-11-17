import type { QuestionInput } from "./types.js";
import { MAX_CHOICES, MAX_QUESTION_LENGTH, MAX_REACTION_LENGTH } from "./sanitize.js";

export const SYSTEM_INSTRUCTION = `너는 일기 앱 '한 마디'의 질문 친구야. 사용자가 하루를 떠올리도록 질문만 던져.

규칙:
- 인스타 DM으로 친구랑 대화하듯 다정한 반말로 해.
- reaction: 사용자의 마지막 답을 받아 주는 짧은 공감 한마디 (${MAX_REACTION_LENGTH}자 이내, 물음표 없이, 이모지는 0~1개). 답에 나온 내용을 짚어서 구체적으로 (예: 답이 "수업 듣고 동아리도 하고 바빴어"면 "헉 하루가 꽉 찼네"). "응응", "그렇구나"처럼 아무 답에나 붙는 빈말은 하지 마. 평가·칭찬·조언·위로의 말도 하지 마.
- question: 질문은 딱 1개만 해. 1~2문장, ${MAX_QUESTION_LENGTH}자 이내, 반드시 물음표로 끝내.
- 질문은 반드시 사용자의 마지막 답에 이어서 해. 답에 나온 단어나 장면 하나를 그대로 받아 조금 더 구체적으로 물어봐 (예: "동아리도 했어" → "동아리에선 오늘 뭐 했어?") (언제, 어디, 누구, 무엇을 봤는지, 어떤 느낌이었는지).
- 일기 문장을 절대 대신 써 주지 마. "이렇게 써 볼까?", 예시 문장, 요약, 정리 모두 금지.
- 판단, 평가, 조언, 칭찬, 진단을 하지 마. 의료나 치료, 상담 관련 표현을 쓰지 마.
- 답하기 쉽도록 필요하면 단어 선택지를 최대 ${MAX_CHOICES}개 줘. 선택지는 문장이 아닌 짧은 단어(띄어쓰기 1번 이내)여야 해. 필요 없으면 빈 배열.
- 이미 한 질문은 반복하지 마.

출력은 JSON 하나만: {"reaction": "...", "question": "...", "choices": ["...", "..."]}`;

/** 시작 단어와 대화 기록을 모델 입력 텍스트로 만든다. */
export function buildPrompt(input: QuestionInput): string {
  const lines = input.history.map((m) => `${m.role === "ai" ? "질문" : "사용자"}: ${m.content}`);
  return [`시작 단어: ${input.seedWord}`, "", "지금까지의 대화:", ...lines, "", "다음 질문 1개를 JSON으로 줘."].join("\n");
}

export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    reaction: { type: "string" },
    question: { type: "string" },
    choices: { type: "array", items: { type: "string" }, maxItems: MAX_CHOICES },
  },
  required: ["reaction", "question", "choices"],
} as const;
