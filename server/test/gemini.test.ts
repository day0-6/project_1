import { ApiError } from "@google/genai";
import { describe, expect, it } from "vitest";
import { GeminiQuestioner, type GenerateFn } from "../src/ai/gemini.js";
import { MockQuestioner } from "../src/ai/mock.js";
import { buildPrompt } from "../src/ai/prompt.js";
import type { QuestionInput } from "../src/ai/types.js";

const input: QuestionInput = {
  seedWord: "알바",
  history: [
    { role: "ai", content: "오늘 가장 기억에 남는 단어 하나만 알려줄래?" },
    { role: "user", content: "알바" },
    { role: "ai", content: "'알바' 하면 오늘 어떤 장면이 떠올라?" },
    { role: "user", content: "손님이 많았어" },
  ],
};

const silent = () => {};
const make = (generate: GenerateFn, timeoutMs = 1000) =>
  new GeminiQuestioner({ model: "test-model", timeoutMs, generate, rng: () => 0, log: silent });

describe("GeminiQuestioner", () => {
  it("규칙에 맞는 응답은 그대로", async () => {
    const q = make(async () => JSON.stringify({ question: "손님 중에 기억나는 사람 있어?", choices: ["있어", "없어"] }));
    expect(await q.nextQuestion(input)).toEqual({ question: "손님 중에 기억나는 사람 있어?", choices: ["있어", "없어"], source: "gemini" });
  });

  it("모델 이름은 설정값을 쓴다", async () => {
    let usedModel = "";
    await make(async ({ model }) => {
      usedModel = model;
      return '{"question":"어땠어?","choices":[]}';
    }).nextQuestion(input);
    expect(usedModel).toBe("test-model");
  });

  it("일기 문장을 대신 쓰면 버리고 미리 정한 질문", async () => {
    const q = make(async () => JSON.stringify({ question: "'오늘 손님이 많아서 힘들었다'라고 써 볼까?", choices: [] }));
    const turn = await q.nextQuestion(input);
    expect(turn.source).toBe("fallback");
    expect(turn.question).not.toContain("써 볼까");
  });

  it("429면 미리 정한 질문 (throw 안 함)", async () => {
    const q = make(async () => {
      throw new ApiError({ message: "quota", status: 429 });
    });
    const turn = await q.nextQuestion(input);
    expect(turn.source).toBe("fallback");
    expect(turn.question.endsWith("?")).toBe(true);
  });

  it("네트워크 오류도 미리 정한 질문", async () => {
    const turn = await make(async () => {
      throw new TypeError("fetch failed");
    }).nextQuestion(input);
    expect(turn.source).toBe("fallback");
  });

  it("타임아웃이면 미리 정한 질문", async () => {
    const hang: GenerateFn = ({ signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    const turn = await make(hang, 20).nextQuestion(input);
    expect(turn.source).toBe("fallback");
  });

  it("이미 한 질문은 피한다", async () => {
    const turn = await make(async () => "not json").nextQuestion({
      ...input,
      history: [...input.history, { role: "ai", content: "그때 기분을 한 단어로 하면 뭐야?" }, { role: "user", content: "피곤" }],
    });
    expect(turn.question).not.toBe("그때 기분을 한 단어로 하면 뭐야?");
  });
});

describe("MockQuestioner", () => {
  it("첫 질문은 시작 단어를 쓴다", async () => {
    const turn = await new MockQuestioner().nextQuestion({ seedWord: "비", history: input.history.slice(0, 2) });
    expect(turn.question).toContain("'비'");
    expect(turn.source).toBe("mock");
  });
});

describe("buildPrompt", () => {
  it("시작 단어와 대화를 담는다", () => {
    const p = buildPrompt(input);
    expect(p).toContain("시작 단어: 알바");
    expect(p).toContain("사용자: 손님이 많았어");
  });
});
