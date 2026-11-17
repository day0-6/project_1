import type { AiTurn, QuestionInput } from "./types.js";

type Preset = { question: string; choices: string[] };

/** 시작 단어 직후 첫 질문. 조사 문제를 피하려고 단어를 따옴표로 감싼다. */
const FIRST_QUESTIONS: ReadonlyArray<(word: string) => Preset> = [
  (w) => ({ question: `'${w}' 하면 오늘 어떤 장면이 떠올라?`, choices: [] }),
  (w) => ({ question: `'${w}', 그때 어디에 있었어?`, choices: ["집", "밖", "학교"] }),
  (w) => ({ question: `'${w}' 하면 누가 같이 떠올라?`, choices: ["나 혼자", "친구", "가족"] }),
];

/** 이어지는 꼬리 질문. 판단·조언 없이 장면과 감각을 묻는다. */
const FOLLOW_UP_QUESTIONS: ReadonlyArray<Preset> = [
  { question: "그때 기분을 한 단어로 하면 뭐야?", choices: ["뿌듯", "피곤", "그냥 그래"] },
  { question: "그 다음엔 어떻게 됐어?", choices: [] },
  { question: "그때 누가 옆에 있었어?", choices: ["혼자", "친구", "가족"] },
  { question: "그 순간 무슨 소리나 냄새가 났어?", choices: [] },
  { question: "그 일 바로 전에는 뭘 하고 있었어?", choices: [] },
  { question: "그때 속으로 무슨 말을 했어?", choices: [] },
  { question: "지금 떠올려 보면 어떤 느낌이 남아 있어?", choices: ["편안", "아쉬움", "모르겠어"] },
  { question: "그중에 제일 오래 기억날 것 같은 건 뭐야?", choices: [] },
];

/**
 * 짧은 답(단어 하나 정도)은 그 말을 그대로 받아서 묻는다. 답을 읽은 것처럼 이어지게.
 * 미리 정한 질문에는 공감 한마디를 붙이지 않는다 — 답을 모르고 하는 공감은 빈말이 되기 때문.
 */
const ECHO_QUESTIONS: ReadonlyArray<(answer: string) => Preset> = [
  (a) => ({ question: `'${a}', 거기서 뭐가 제일 기억나?`, choices: [] }),
  (a) => ({ question: `'${a}' 하니까 어떤 장면이 떠올라?`, choices: [] }),
  (a) => ({ question: `'${a}' 얘기 조금만 더 해 줄래?`, choices: [] }),
];
const MAX_ECHO_LENGTH = 10;

/** 따옴표 안에 넣어도 자연스러운 짧은 답이면 돌려준다 */
function echoable(answer: string | undefined): string | null {
  const a = (answer ?? "").replace(/['"‘’“”]/g, "").trim();
  if (a.length === 0 || a.length > MAX_ECHO_LENGTH) return null;
  if (/[?!.,~…]/.test(a) || a.split(/\s+/).length > 2) return null;
  return a;
}

export type Rng = () => number;

function askedQuestions(input: QuestionInput): Set<string> {
  return new Set(input.history.filter((m) => m.role === "ai").map((m) => questionOf(m.content)));
}

/** AI 메시지는 "공감\n질문" 형태로 저장된다. 마지막 줄이 질문이다. */
export function questionOf(content: string): string {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? content;
}

function answerCount(input: QuestionInput): number {
  return input.history.filter((m) => m.role === "user").length;
}

function pickUnused(presets: Preset[], asked: Set<string>, index: number): Preset {
  const unused = presets.filter((p) => !asked.has(p.question));
  const pool = unused.length > 0 ? unused : presets;
  const picked = pool[Math.abs(index) % pool.length];
  if (!picked) throw new Error("빈 질문 목록");
  return picked;
}

/**
 * 미리 정해 둔 질문 중 하나를 고른다.
 * rng를 주면 무작위, 안 주면 턴 수 기반으로 결정적으로 고른다(mock/테스트용).
 */
export function pickPresetQuestion(
  input: QuestionInput,
  source: AiTurn["source"],
  rng?: Rng,
): AiTurn {
  const asked = askedQuestions(input);
  const turn = answerCount(input);
  // 첫 user 메시지는 시작 단어 → 그 직후에는 시작 단어를 활용한 질문
  const isFirst = turn <= 1;
  const lastAnswer = echoable([...input.history].reverse().find((m) => m.role === "user")?.content);
  const presets = isFirst
    ? FIRST_QUESTIONS.map((f) => f(input.seedWord))
    : lastAnswer
      ? ECHO_QUESTIONS.map((f) => f(lastAnswer))
      : [...FOLLOW_UP_QUESTIONS];
  const index = rng ? Math.floor(rng() * presets.length) : turn;
  const picked = pickUnused(presets, asked, index);
  return { reaction: "", question: picked.question, choices: [...picked.choices], source };
}
