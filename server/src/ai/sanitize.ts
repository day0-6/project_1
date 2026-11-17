import { z } from "zod";

/**
 * 절대 원칙 1의 마지막 방어선.
 * AI가 질문이 아닌 것(일기 문장 대신 쓰기, 조언, 진단 등)을 내면 버린다.
 */

export const MAX_QUESTION_LENGTH = 80;
export const MAX_REACTION_LENGTH = 30;
export const MAX_CHOICES = 3;
export const MAX_CHOICE_LENGTH = 8;

/** 일기 문장을 대신 써 주거나 써 보라고 제안하는 표현 */
const WRITING_FOR_USER = [
  "써 볼까", "써볼까", "써 봐", "써봐", "써 보는", "써보는", "써 줄게", "써줄게",
  "적어 볼까", "적어볼까", "적어 봐", "적어봐", "적어 줄게", "적어줄게",
  "이렇게 써", "이렇게 적", "라고 써", "라고 적", "처럼 써", "처럼 적",
  "예를 들어", "예시", "일기에", "문장으로", "정리해 줄게", "정리해줄게", "정리하면",
];

/** 판단·조언 표현 */
const ADVICE = ["는 게 좋", "는게 좋", "힘내", "화이팅", "파이팅", "하면 좋겠", "추천", "잘못", "잘했어", "괜찮을 거야"];
/** "-아/어/여야 해/돼/겠" (쉬어야 해, 해야 돼 등) */
const ADVICE_PATTERN = /[아어여해]야\s?(해|돼|되|한다|겠)/;

/** 의료·치료 표현 */
const MEDICAL = ["치료", "진단", "증상", "장애", "우울증", "불안장애", "상담", "처방", "병원", "약물", "ADHD", "adhd", "정신과", "질환"];

const FORBIDDEN = [...WRITING_FOR_USER, ...ADVICE, ...MEDICAL];

const RawTurn = z.object({
  reaction: z.string().optional(),
  question: z.string(),
  choices: z.array(z.string()).optional(),
});

export type CleanTurn = { reaction: string; question: string; choices: string[] };

function containsForbidden(text: string): boolean {
  return ADVICE_PATTERN.test(text) || FORBIDDEN.some((phrase) => text.includes(phrase));
}

function normalize(text: string): string {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, "")
    .trim();
}

function countSentences(text: string): number {
  return text.split(/[.!?。…~]+/).filter((s) => s.trim().length > 0).length;
}

export function cleanQuestion(raw: string): string | null {
  const q = normalize(raw).replace(/？/g, "?");
  if (q.length === 0 || q.length > MAX_QUESTION_LENGTH) return null;
  if (!q.endsWith("?")) return null;
  if ((q.match(/\?/g) ?? []).length !== 1) return null; // 질문은 정확히 1개
  if (countSentences(q) > 2) return null;
  if (containsForbidden(q)) return null;
  return q;
}

/**
 * 공감 한마디. 질문이 아니고(물음표 없음), 짧고, 금지 표현이 없어야 한다.
 * 규칙에 안 맞으면 질문은 살리고 공감만 버린다.
 */
export function cleanReaction(raw: string): string | null {
  const r = normalize(raw);
  if (r.length === 0 || r.length > MAX_REACTION_LENGTH) return null;
  if (/[?？]/.test(r)) return null;
  if (countSentences(r) > 1) return null;
  if (containsForbidden(r)) return null;
  return r;
}

export function cleanChoice(raw: string): string | null {
  const c = normalize(raw);
  if (c.length === 0 || c.length > MAX_CHOICE_LENGTH) return null;
  if (/[.?!,，。:;"'()\[\]]/.test(c)) return null; // 문장이 아닌 단어만
  if (c.split(" ").length > 2) return null;
  if (containsForbidden(c)) return null;
  return c;
}

/** 모델 출력(JSON 파싱 결과)을 검사한다. 질문이 부적합하면 null → 미리 정해 둔 질문으로 대체. */
export function sanitizeTurn(raw: unknown): CleanTurn | null {
  const parsed = RawTurn.safeParse(raw);
  if (!parsed.success) return null;
  const question = cleanQuestion(parsed.data.question);
  if (!question) return null;
  const choices = [...new Set((parsed.data.choices ?? []).map(cleanChoice).filter((c): c is string => c !== null))]
    .slice(0, MAX_CHOICES);
  const reaction = parsed.data.reaction ? (cleanReaction(parsed.data.reaction) ?? "") : "";
  return { reaction, question, choices };
}

/** 모델이 낸 텍스트(JSON 기대)를 파싱 + 검사 */
export function sanitizeModelText(text: string | undefined): CleanTurn | null {
  if (!text) return null;
  const jsonText = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return sanitizeTurn(JSON.parse(jsonText));
  } catch {
    return null;
  }
}
