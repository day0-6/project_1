import { ApiError } from "@google/genai";
import { describe, expect, it } from "vitest";
import {
  buildDraftPrompt,
  checkDraft,
  DRAFT_SYSTEM_INSTRUCTION,
  fallbackDraft,
  GeminiDrafter,
  MockDrafter,
  newWords,
  parseDraftText,
  type DraftInput,
} from "../src/ai/diaryDraft.js";
import type { GenerateFn } from "../src/ai/gemini.js";

const input: DraftInput = {
  seedWord: "알바",
  answers: ["손님이 엄청 많았어", "사장님이 커피를 사 줬어", "좀 뿌듯했어"],
};
const FALLBACK = { content: "손님이 엄청 많았어\n사장님이 커피를 사 줬어\n좀 뿌듯했어", source: "fallback" };

describe("checkDraft", () => {
  it("순서 정리·문체 변환·연결어만 한 초안은 통과", () => {
    const draft = "알바를 했다. 손님이 엄청 많았다. 그래서 사장님이 커피를 사 줬다. 좀 뿌듯했다.";
    expect(checkDraft(draft, input)).toEqual({ ok: true, content: draft });
  });

  it("줄바꿈과 공백은 다듬는다", () => {
    const res = checkDraft("  손님이 엄청   많았다.\n\n\n\n사장님이 커피를 사 줬다.  ", input);
    expect(res).toEqual({ ok: true, content: "손님이 엄청 많았다.\n\n사장님이 커피를 사 줬다." });
  });

  it("문장 끝 '다' 앞의 띄어쓰기는 붙이고, 문장 안의 '다'(모두)는 그대로 둔다", () => {
    const answers = ["기계소음 너무 시끄러워", "그냥 다 싫어", "자고 싶지"];
    const res = checkDraft("기계소음이 너무 시끄러웠 다. 그냥 다 싫었다. 자고 싶었 다", { seedWord: "알바", answers });
    expect(res).toEqual({ ok: true, content: "기계소음이 너무 시끄러웠다. 그냥 다 싫었다. 자고 싶었다" });
  });

  it("물음표가 있으면 탈락", () => {
    expect(checkDraft("손님이 엄청 많았다. 왜 그렇게 많았을까?", input)).toMatchObject({ reason: "question" });
    expect(checkDraft("손님이 엄청 많았다？", input)).toMatchObject({ reason: "question" });
  });

  it("'다'로 끝나는 문장이 60% 미만이면 탈락", () => {
    expect(checkDraft("손님이 엄청 많았어. 사장님이 커피를 사 줬어. 좀 뿌듯했다.", input)).toMatchObject({ reason: "style" });
  });

  it("사용자가 말하지 않은 감정·사건·교훈을 넣으면 탈락", () => {
    const draft = "손님이 엄청 많았다. 너무 지치고 힘들었지만 사장님이 커피를 사 줬다. 역시 열심히 하면 보상이 따른다는 걸 배웠다.";
    expect(checkDraft(draft, input)).toMatchObject({ reason: "new_content" });
  });

  it("새 단어는 3개까지 허용, 4개부터 탈락", () => {
    const answers = ["학교 갔어", "수업 듣고 동아리도 했어", "친구랑 떡볶이 먹었어", "맛있었어", "집에 와서 잤어"];
    const ok = "학교에 갔다. 수업 듣고 동아리도 했다. 친구랑 매운 떡볶이 먹었다. 맛있었다. 집에 와서 푹 잤다.";
    expect(checkDraft(ok, { seedWord: "학교", answers })).toMatchObject({ ok: true });
    const tooMany = "학교에 갔다. 지루한 수업 듣고 동아리도 했다. 친구랑 매운 떡볶이 먹었다. 정말 맛있었다. 집에 와서 푹 잤다.";
    expect(checkDraft(tooMany, { seedWord: "학교", answers })).toMatchObject({ reason: "new_content" });
  });

  it("새 단어가 3개 이하여도 20%를 넘으면 탈락", () => {
    expect(checkDraft("비가 와서 우울했다.", { seedWord: "비", answers: ["비 왔어"] })).toMatchObject({ reason: "new_content" });
  });

  it("연결어와 문체용 말은 새 단어로 세지 않는다", () => {
    const { added } = newWords("오늘은 알바를 했다. 그리고 손님이 엄청 많았다. 그러다가 사장님이 커피를 사 줬다.", input);
    expect(added).toEqual([]);
  });

  it("활용형이 바뀌어도 사용자 말로 본다 (갔어→갔다, 바빠→바빴다)", () => {
    expect(newWords("학교에 갔다. 바빴다.", { seedWord: "학교", answers: ["학교 갔어", "바빠"] }).added).toEqual([]);
  });

  it("답변 길이의 1.8배 + 40자를 넘거나 1500자를 넘으면 탈락", () => {
    const short: DraftInput = { seedWord: "비", answers: ["비 왔어"] };
    expect(checkDraft("비가 왔다. ".repeat(10), short)).toMatchObject({ reason: "length" });
    const long: DraftInput = { seedWord: "비", answers: ["비 왔어 ".repeat(400)] };
    expect(checkDraft("비 왔다. ".repeat(260), long)).toMatchObject({ reason: "length" });
  });

  it("빈 초안은 탈락", () => {
    expect(checkDraft("  \n ", input)).toMatchObject({ reason: "empty" });
  });
});

describe("parseDraftText", () => {
  it("JSON의 draft만 꺼낸다", () => {
    expect(parseDraftText('```json\n{"draft":"손님이 많았다."}\n```')).toBe("손님이 많았다.");
    expect(parseDraftText('{"text":"x"}')).toBeNull();
    expect(parseDraftText("그냥 글")).toBeNull();
    expect(parseDraftText(undefined)).toBeNull();
  });
});

describe("fallbackDraft", () => {
  it("답변을 이어 붙이고, 없으면 시작 단어", () => {
    expect(fallbackDraft(input)).toEqual(FALLBACK);
    expect(fallbackDraft({ seedWord: "비", answers: [" "] })).toEqual({ content: "비", source: "fallback" });
  });
});

describe("프롬프트 예시", () => {
  it("예시 초안은 모두 검사를 통과한다 (모델이 따라 써도 탈락하지 않게)", () => {
    const examples = [...DRAFT_SYSTEM_INSTRUCTION.matchAll(/답변: (.+)\n출력: (\{.+\})/g)];
    expect(examples.length).toBeGreaterThanOrEqual(2);
    for (const [, answerLine = "", output = ""] of examples) {
      const answers = answerLine.split(" / ").map((a) => a.replace(/^\d+\. /, ""));
      const draft = parseDraftText(output) ?? "";
      expect(checkDraft(draft, { seedWord: "", answers })).toMatchObject({ ok: true });
    }
  });
});

describe("buildDraftPrompt", () => {
  it("사용자 답변만 넣고 AI 질문은 넣지 않는다", () => {
    const prompt = buildDraftPrompt(input);
    expect(prompt).toContain("1. 손님이 엄청 많았어");
    expect(prompt).toContain("3. 좀 뿌듯했어");
    expect(prompt).not.toContain("질문:");
  });
});

describe("MockDrafter", () => {
  it("AI 없이 대체 초안", async () => {
    expect(await new MockDrafter().draft(input)).toEqual(FALLBACK);
  });
});

describe("GeminiDrafter", () => {
  const silent = () => {};
  const make = (generate: GenerateFn, retries?: number) =>
    new GeminiDrafter({ model: "m1, m2", timeoutMs: 1000, generate, log: silent, ...(retries !== undefined ? { retries } : {}) });
  const reply = (draft: string) => JSON.stringify({ draft });
  const GOOD = "손님이 엄청 많았다. 그래서 사장님이 커피를 사 줬다. 좀 뿌듯했다.";

  it("검사를 통과하면 AI 초안", async () => {
    let used: Parameters<GenerateFn>[0] | undefined;
    const d = make(async (args) => {
      used = args;
      return reply(GOOD);
    });
    expect(await d.draft(input)).toEqual({ content: GOOD, source: "ai" });
    expect(used?.model).toBe("m1");
    expect(used?.systemInstruction).toContain("일기 초안");
  });

  it("검사에 떨어지면 대체 초안 (기본 재시도 0)", async () => {
    let calls = 0;
    const d = make(async () => (calls++, reply("손님이 많았다. 왜 그랬을까?")));
    expect(await d.draft(input)).toEqual(FALLBACK);
    expect(calls).toBe(1);
  });

  it("검사 탈락은 retries만큼 다시 시도", async () => {
    const replies = [reply("손님이 많았어?"), reply(GOOD)];
    let calls = 0;
    const d = make(async () => replies[calls++], 1);
    expect(await d.draft(input)).toEqual({ content: GOOD, source: "ai" });
    expect(calls).toBe(2);
  });

  it("429는 재시도·다른 모델 없이 바로 대체", async () => {
    const models: string[] = [];
    const d = make(async ({ model }) => {
      models.push(model);
      throw new ApiError({ message: "quota", status: 429 });
    }, 2);
    expect(await d.draft(input)).toEqual(FALLBACK);
    expect(models).toEqual(["m1"]);
  });

  it("네트워크 오류도 바로 대체", async () => {
    let calls = 0;
    const d = make(async () => {
      calls++;
      throw new TypeError("fetch failed");
    }, 2);
    expect(await d.draft(input)).toEqual(FALLBACK);
    expect(calls).toBe(1);
  });

  it("시간 초과면 대체", async () => {
    const d = new GeminiDrafter({
      model: "m1",
      timeoutMs: 20,
      log: silent,
      generate: ({ signal }) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
    });
    expect(await d.draft(input)).toEqual(FALLBACK);
  });

  it("JSON이 아니면 대체", async () => {
    expect(await make(async () => "손님이 많았다.").draft(input)).toEqual(FALLBACK);
  });

  it("답변이 없으면 AI를 부르지 않는다", async () => {
    let calls = 0;
    const d = make(async () => (calls++, reply("비가 왔다.")));
    expect(await d.draft({ seedWord: "비", answers: [] })).toEqual({ content: "비", source: "fallback" });
    expect(calls).toBe(0);
  });
});
