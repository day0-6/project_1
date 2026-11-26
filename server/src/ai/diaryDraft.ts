import { ApiError } from "@google/genai";
import { modelList, type GenerateFn } from "./gemini.js";

/**
 * 절대 원칙 1 — 대화가 끝난 뒤의 일기 초안.
 * AI는 사용자 답변의 순서 정리, "~했다" 문체 변환, 연결어로 잇기만 할 수 있다.
 * 프롬프트로 지시하고, 응답은 checkDraft로 다시 검사한다. 떨어지면 답변을 이어 붙인 대체 초안을 쓴다.
 */

export type DraftSource = "ai" | "fallback";
export type DiaryDraft = { content: string; source: DraftSource };

export type DraftInput = {
  seedWord: string;
  /** 시작 단어를 뺀 사용자 답변 (오래된 순) */
  answers: string[];
};

/** 초안을 만든다. 절대 throw하지 않는다 — 실패 시 대체 초안을 돌려준다. */
export interface Drafter {
  draft(input: DraftInput): Promise<DiaryDraft>;
}

// ─────────────────────────────────────────────
// 대체 초안
// ─────────────────────────────────────────────

/** 답변을 순서대로 이어 붙인다. 답변이 없으면 시작 단어 (빈 화면 금지). */
export function fallbackDraft(input: DraftInput): DiaryDraft {
  const answers = input.answers.map((a) => a.trim()).filter(Boolean);
  return { content: answers.length > 0 ? answers.join("\n") : input.seedWord, source: "fallback" };
}

// ─────────────────────────────────────────────
// 응답 검사
// ─────────────────────────────────────────────

export const MAX_DRAFT_LENGTH = 1500;
const LENGTH_RATIO = 1.8;
const LENGTH_SLACK = 40;
const MIN_DA_RATIO = 0.6;
const MAX_NEW_WORDS = 3;
const MAX_NEW_WORD_RATIO = 0.2;

/**
 * 새 내용 검사에서 빼는 말: 연결어와 일기 문체용 말.
 * 사건·감정·꾸밈을 더하지 않고 문장을 잇거나 "~했다" 꼴을 만드는 데만 쓰인다.
 */
const CONNECTIVES = [
  "그리고", "그래서", "그러다", "그러다가", "그러고", "그러고는", "그러고서", "그런데", "근데", "하지만", "그러나",
  "그래도", "그러니까", "그러면서", "그다음", "그다음엔", "다음", "다음엔", "그때", "그때는", "또", "또한", "그",
  "그리고는", "먼저", "처음엔", "결국",
];
const STYLE_WORDS = [
  "오늘", "오늘은", "오늘도", "나", "나는", "내가", "나도", "나랑", "했다", "한다", "했고", "하고", "해서", "하며",
  "있었다", "있었고", "있다", "없었다", "였다", "이었다", "이다", "것", "것이다", "거", "거다", "됐다", "되었다",
];
const IGNORED = new Set([...CONNECTIVES, ...STYLE_WORDS]);

/** 단어 끝에서 떼어 보는 조사·어미. 긴 것부터. */
const SUFFIXES = [
  "이었다", "였었다", "었었다", "았었다", "에서는", "에서도", "으로는", "이라서", "라서",
  "었다", "았다", "였다", "했다", "한다", "는다", "었고", "았고", "였고", "했고", "어서", "아서", "해서",
  "는데", "은데", "지만", "면서", "니까", "에서", "으로", "에게", "한테", "이랑", "하고", "까지", "부터", "처럼", "보다",
  "다", "고", "서", "은", "는", "이", "가", "을", "를", "에", "도", "와", "과", "랑", "의", "로", "만",
];

function words(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** 사용자가 쓴 말에 이 단어(또는 조사·어미를 뗀 줄기)가 들어 있는가 */
function isUserWord(word: string, corpus: string): boolean {
  if (corpus.includes(word)) return true;
  for (const suffix of SUFFIXES) {
    if (!word.endsWith(suffix) || word.length <= suffix.length) continue;
    const stem = word.slice(0, -suffix.length);
    if (corpus.includes(stem)) return true;
    // 불규칙 활용(갔다↔가, 바빴다↔바빠): 줄기 끝 한 글자를 더 떼어 본다
    if (stem.length >= 2 && corpus.includes(stem.slice(0, -1))) return true;
  }
  return false;
}

/** 사용자 답변에 없는 단어들. 연결어·문체용 말은 세지 않는다. */
export function newWords(draft: string, input: DraftInput): { added: string[]; total: number } {
  const corpus = [input.seedWord, ...input.answers].join(" ").replace(/\s+/g, "");
  const counted = words(draft).filter((w) => !IGNORED.has(w));
  return { added: counted.filter((w) => !isUserWord(w, corpus)), total: counted.length };
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!。…~])\s*|\n+/)
    .map((s) => s.replace(/[\s.!。…~"'”’)」]+$/u, "").trim())
    .filter(Boolean);
}

export type DraftCheck = { ok: true; content: string } | { ok: false; reason: "empty" | "length" | "question" | "style" | "new_content" };

/** 모델이 낸 초안을 검사한다. 통과하면 다듬은 글, 아니면 떨어진 이유. */
export function checkDraft(raw: string, input: DraftInput): DraftCheck {
  const content = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[*_#`>]/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        // 모델이 가끔 "싶었 다."처럼 끝의 "다"를 띄운다 → 붙인다 (문장 끝일 때만. "다 시끄러웠다"의 "다"는 그대로)
        .replace(/([가-힣]) 다(?=[.!。…~]|$)/g, "$1다")
        .trim(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (content.length === 0) return { ok: false, reason: "empty" };

  const answerLength = input.answers.join("\n").length;
  if (content.length > MAX_DRAFT_LENGTH || content.length > answerLength * LENGTH_RATIO + LENGTH_SLACK) {
    return { ok: false, reason: "length" };
  }
  if (/[?？]/.test(content)) return { ok: false, reason: "question" };

  const all = sentences(content);
  const endsWithDa = all.filter((s) => s.endsWith("다")).length;
  if (all.length === 0 || endsWithDa / all.length < MIN_DA_RATIO) return { ok: false, reason: "style" };

  const { added, total } = newWords(content, input);
  if (added.length > MAX_NEW_WORDS || (total > 0 && added.length / total > MAX_NEW_WORD_RATIO)) {
    return { ok: false, reason: "new_content" };
  }
  return { ok: true, content };
}

/** 모델 출력(JSON {"draft": "..."} 기대)에서 초안 글을 꺼낸다 */
export function parseDraftText(text: string | undefined): string | null {
  if (!text) return null;
  const jsonText = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (parsed && typeof parsed === "object" && typeof (parsed as { draft?: unknown }).draft === "string") {
      return (parsed as { draft: string }).draft;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// 프롬프트
// ─────────────────────────────────────────────

export const DRAFT_SYSTEM_INSTRUCTION = `너는 일기 앱 '한 마디'의 정리 도우미야. 사용자가 대화에서 한 답변만 가지고 일기 초안을 정리해.

할 수 있는 일은 딱 세 가지야:
1. 답변의 순서를 자연스럽게 정리하기
2. 말투를 일기 문체 "~했다"로 바꾸기 (예: "손님이 많았어" → "손님이 많았다")
3. "그리고", "그러다", "그다음" 같은 연결어로 문장 잇기

절대 하지 마:
- 사용자가 말하지 않은 사건, 감정, 꾸밈말을 넣기
- 조언, 교훈, 해석, 평가, 다짐을 넣기
- 사용자가 이유를 말하지 않았는데 "그래서", "왜냐하면", "때문에"로 원인과 결과를 만들기
- 질문하기, 물음표 쓰기
- 답변보다 길게 늘이기

일기 내용이 아니라 앱이나 질문에 대고 한 말(예: "뭔 소리야", "질문 그만해", "너 질문만 하니")은 빼.
사용자가 쓴 단어를 최대한 그대로 써.
답변을 그대로 이어 붙이지 마. 모든 문장의 끝을 반드시 "~다."로 바꿔.
단어만 있는 답도 "~했다", "~였다", "~이었다"를 붙여 문장으로 만들어.

예시 1)
답변: 1. 손님이 엄청 많았어 / 2. 사장님이 커피 사 줬어 / 3. 뿌듯
출력: {"draft": "손님이 엄청 많았다. 그리고 사장님이 커피 사 줬다. 뿌듯했다."}

예시 2)
답변: 1. 친구 / 2. 장난침 / 3. 뭔 소리야 / 4. 웃겼지 / 5. 모르겠어
출력: {"draft": "친구였다. 장난쳤다. 웃겼다. 모르겠다."}

출력은 JSON 하나만: {"draft": "..."}`;

export const DRAFT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: { draft: { type: "string" } },
  required: ["draft"],
} as const;

export function buildDraftPrompt(input: DraftInput): string {
  const lines = input.answers.map((a, i) => `${i + 1}. ${a}`);
  return [`시작 단어: ${input.seedWord}`, "", "사용자 답변 (말한 순서):", ...lines, "", "이 답변만으로 일기 초안을 JSON으로 줘."].join(
    "\n",
  );
}

// ─────────────────────────────────────────────
// 구현
// ─────────────────────────────────────────────

/** MOCK_AI=true: AI를 부르지 않고 대체 초안을 돌려준다. */
export class MockDrafter implements Drafter {
  async draft(input: DraftInput): Promise<DiaryDraft> {
    return fallbackDraft(input);
  }
}

type Options = {
  model: string;
  timeoutMs: number;
  generate: GenerateFn;
  /** 검사에 떨어졌을 때 다시 시도하는 횟수 (기본 0) */
  retries?: number;
  log?: (msg: string) => void;
};

export class GeminiDrafter implements Drafter {
  constructor(private readonly opts: Options) {}

  async draft(input: DraftInput): Promise<DiaryDraft> {
    const { retries = 0, log = console.warn } = this.opts;
    if (input.answers.every((a) => !a.trim())) return fallbackDraft(input);
    // 초안은 다른 모델로 넘어가지 않는다: 429·네트워크 오류는 재시도 없이 바로 대체
    const model = modelList(this.opts.model)[0];
    if (!model) return fallbackDraft(input);
    const prompt = buildDraftPrompt(input);

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
      let text: string | undefined;
      try {
        text = await this.opts.generate({
          model,
          prompt,
          signal: controller.signal,
          systemInstruction: DRAFT_SYSTEM_INSTRUCTION,
          responseJsonSchema: DRAFT_RESPONSE_JSON_SCHEMA,
          temperature: 0.2,
        });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : controller.signal.aborted ? "timeout" : "network";
        log(`[ai] 일기 초안 ${model} 호출 실패(${status}) → 대체 초안`);
        return fallbackDraft(input);
      } finally {
        clearTimeout(timer);
      }
      const raw = parseDraftText(text);
      const result = raw === null ? ({ ok: false, reason: "empty" } as const) : checkDraft(raw, input);
      if (result.ok) return { content: result.content, source: "ai" };
      // 사용자 글은 로그에 남기지 않고 떨어진 이유만
      log(`[ai] 일기 초안 검사 탈락(${result.reason}) ${attempt + 1}/${retries + 1}`);
    }
    return fallbackDraft(input);
  }
}
