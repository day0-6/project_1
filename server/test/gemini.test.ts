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
    expect(await q.nextQuestion(input)).toEqual({ reaction: "", question: "손님 중에 기억나는 사람 있어?", choices: ["있어", "없어"], source: "gemini" });
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

describe("미리 정한 질문", () => {
  it("짧은 답은 그 말을 넣어 묻고, 빈 공감은 붙이지 않는다", async () => {
    const q = new MockQuestioner();
    const turn = await q.nextQuestion({
      seedWord: "학교",
      history: [
        { role: "ai", content: "오늘 가장 기억에 남는 단어 하나만 알려줄래?" },
        { role: "user", content: "학교" },
        { role: "ai", content: "'학교', 그때 어디에 있었어?" },
        { role: "user", content: "동아리방" },
      ],
    });
    expect(turn.reaction).toBe("");
    expect(turn.question).toContain("'동아리방'");
  });
  it("긴 답에는 따옴표로 되풀이하지 않는다", async () => {
    const q = new MockQuestioner();
    const turn = await q.nextQuestion({
      seedWord: "학교",
      history: [
        { role: "ai", content: "오늘 가장 기억에 남는 단어 하나만 알려줄래?" },
        { role: "user", content: "학교" },
        { role: "ai", content: "'학교', 그때 어디에 있었어?" },
        { role: "user", content: "수업 듣고 동아리도 하고 할 게 많아서 바빴어" },
      ],
    });
    expect(turn.question).not.toContain("'");
  });
});

describe("모델 여러 개", () => {
  it("붐비거나(503) 없는 모델(404)이면 다음 모델로 넘어간다", async () => {
    const tried: string[] = [];
    const q = new GeminiQuestioner({
      model: "busy-model, gone-model, ok-model",
      timeoutMs: 1000,
      rng: () => 0,
      log: silent,
      generate: async ({ model }) => {
        tried.push(model);
        if (model === "busy-model") throw new ApiError({ message: "busy", status: 503 });
        if (model === "gone-model") throw new ApiError({ message: "gone", status: 404 });
        return JSON.stringify({ reaction: "와 정신없었겠다", question: "동아리에선 뭐 했어?", choices: [] });
      },
    });
    const turn = await q.nextQuestion(input);
    expect(tried).toEqual(["busy-model", "gone-model", "ok-model"]);
    expect(turn).toMatchObject({ source: "gemini", reaction: "와 정신없었겠다" });
  });

  it("모두 실패하면 미리 정한 질문", async () => {
    const q = new GeminiQuestioner({
      model: "a,b",
      timeoutMs: 1000,
      rng: () => 0,
      log: silent,
      generate: async () => {
        throw new ApiError({ message: "busy", status: 503 });
      },
    });
    expect((await q.nextQuestion(input)).source).toBe("fallback");
  });
});

describe("느리거나 붐빈 모델", () => {
  it("시간 초과도 다음 모델로 넘어가고, 다음 질문부터는 그 모델을 뒤로 미룬다", async () => {
    const tried: string[] = [];
    const q = new GeminiQuestioner({
      model: "slow-model,ok-model",
      timeoutMs: 1000,
      rng: () => 0,
      log: silent,
      generate: ({ model, signal }) => {
        tried.push(model);
        if (model === "slow-model") {
          return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
        }
        return Promise.resolve(JSON.stringify({ reaction: "", question: "그다음엔 뭐 했어?", choices: [] }));
      },
    });
    expect((await q.nextQuestion(input)).source).toBe("gemini");
    expect(tried).toEqual(["slow-model", "ok-model"]);
    tried.length = 0;
    await q.nextQuestion(input);
    expect(tried).toEqual(["ok-model"]);
  });
});
