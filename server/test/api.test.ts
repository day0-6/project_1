import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { MockQuestioner } from "../src/ai/mock.js";
import type { Questioner } from "../src/ai/types.js";
import { createApp } from "../src/app.js";
import { OPENING_QUESTION } from "../src/domain.js";
import { memoryAuthenticator, MemoryStore } from "./memoryRepo.js";

const A = { Authorization: "Bearer token-user-a" };
const B = { Authorization: "Bearer token-user-b" };

let store: MemoryStore;
let app: ReturnType<typeof createApp>;

function setup(questioner: Questioner = new MockQuestioner()) {
  store = new MemoryStore();
  app = createApp({ authenticate: memoryAuthenticator(store), questioner });
}

beforeEach(() => setup());

async function startSession(seedWord = "알바") {
  const res = await request(app).post("/sessions").set(A).send({ seedWord });
  expect(res.status).toBe(201);
  return res.body as { session: { id: string }; messages: { role: string; content: string }[]; choices: string[] };
}

describe("인증", () => {
  it("토큰이 없으면 401", async () => {
    const res = await request(app).get("/sessions");
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("다시 로그인해 주세요.");
  });
  it("잘못된 토큰이면 401", async () => {
    expect((await request(app).get("/sessions").set({ Authorization: "Bearer nope" })).status).toBe(401);
  });
  it("health는 인증 없이", async () => {
    expect((await request(app).get("/health")).status).toBe(200);
  });
});

describe("POST /sessions", () => {
  it("세션을 만들고 첫 질문을 준다", async () => {
    const body = await startSession("알바");
    expect(body.messages.map((m) => m.role)).toEqual(["ai", "user", "ai"]);
    expect(body.messages[0]?.content).toBe(OPENING_QUESTION);
    expect(body.messages[1]?.content).toBe("알바");
    expect(body.messages[2]?.content).toContain("알바");
    expect(body.messages[2]?.content.endsWith("?")).toBe(true);
    expect(store.events).toEqual([{ user_id: "user-a", type: "session_started" }]);
  });
  it("빈 단어는 400 + 한국어 안내", async () => {
    const res = await request(app).post("/sessions").set(A).send({ seedWord: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("단어를 하나 적어 줘.");
  });
});

describe("대화 → 초안 → 완성", () => {
  it("전체 흐름", async () => {
    const { session } = await startSession();
    const answers = ["손님이 엄청 많았어", "사장님이 커피를 사 줬어", "좀 뿌듯했어"];
    let last: request.Response | undefined;
    for (const content of answers) {
      last = await request(app).post(`/sessions/${session.id}/messages`).set(A).send({ content });
      expect(last.status).toBe(201);
      expect(last.body.userMessage.content).toBe(content);
      expect(last.body.aiMessage.role).toBe("ai");
      expect(last.body.choices.length).toBeLessThanOrEqual(3);
    }
    expect(last?.body.suggestFinish).toBe(true);

    // 메시지는 보낼 때마다 이미 저장됨
    const stored = store.messages.filter((m) => m.session_id === session.id && m.role === "user");
    expect(stored.map((m) => m.content)).toEqual(["알바", ...answers]);

    // 같은 질문을 반복하지 않음
    const questions = store.messages.filter((m) => m.role === "ai").map((m) => m.content);
    expect(new Set(questions).size).toBe(questions.length);

    const draft = await request(app).get(`/sessions/${session.id}/draft`).set(A);
    expect(draft.body).toEqual({ seedWord: "알바", draft: answers.join("\n") });

    const done = await request(app).post(`/sessions/${session.id}/complete`).set(A).send({ content: "오늘 알바는 바빴지만 뿌듯했다." });
    expect(done.status).toBe(201);
    expect(done.body.diary.seed_word).toBe("알바");

    const again = await request(app).post(`/sessions/${session.id}/complete`).set(A).send({ content: "x" });
    expect(again.status).toBe(409);
    expect((await request(app).post(`/sessions/${session.id}/messages`).set(A).send({ content: "x" })).status).toBe(409);

    const list = await request(app).get("/diaries").set(A);
    expect(list.body.diaries).toHaveLength(1);
    const detail = await request(app).get(`/diaries/${done.body.diary.id}`).set(A);
    expect(detail.body.diary.content).toBe("오늘 알바는 바빴지만 뿌듯했다.");
    expect(store.events.map((e) => e.type)).toEqual(["session_started", "diary_completed"]);
  });

  it("답변이 없으면 초안은 시작 단어 (빈 화면 금지)", async () => {
    const { session } = await startSession("비");
    const draft = await request(app).get(`/sessions/${session.id}/draft`).set(A);
    expect(draft.body.draft).toBe("비");
  });
});

describe("보관함 / 이어 하기", () => {
  it("진행 중 세션만 보관함에 보이고, 이어 하면 이벤트가 남는다", async () => {
    const s1 = await startSession("알바");
    await request(app).post(`/sessions/${s1.session.id}/messages`).set(A).send({ content: "손님이 많았어" });
    const s2 = await startSession("산책");
    await request(app).post(`/sessions/${s2.session.id}/complete`).set(A).send({ content: "산책했다" });

    const archive = await request(app).get("/sessions?status=in_progress").set(A);
    expect(archive.body.sessions).toHaveLength(1);
    expect(archive.body.sessions[0]).toMatchObject({ seed_word: "알바", answer_count: 1, last_answer: "손님이 많았어" });

    const resumed = await request(app).post(`/sessions/${s1.session.id}/resume`).set(A);
    expect(resumed.status).toBe(200);
    expect(resumed.body.messages.at(-1).role).toBe("ai");
    expect(store.events.filter((e) => e.type === "session_resumed")).toHaveLength(1);
  });

  it("마지막이 사용자 답이면 이어 할 때 질문을 새로 붙인다", async () => {
    const { session } = await startSession();
    store.messages.push({ id: "x", session_id: session.id, role: "user", content: "질문 저장 전에 끊김", created_at: store.now() });
    const resumed = await request(app).post(`/sessions/${session.id}/resume`).set(A);
    expect(resumed.body.messages.at(-1).role).toBe("ai");
  });

  it("잘못된 status 쿼리는 400", async () => {
    expect((await request(app).get("/sessions?status=deleted").set(A)).status).toBe(400);
  });
});

describe("소유권", () => {
  it("다른 사용자의 세션/일기는 404", async () => {
    const { session } = await startSession();
    expect((await request(app).get(`/sessions/${session.id}`).set(B)).status).toBe(404);
    expect((await request(app).post(`/sessions/${session.id}/messages`).set(B).send({ content: "hi" })).status).toBe(404);
    expect((await request(app).get(`/sessions/${session.id}/draft`).set(B)).status).toBe(404);
    expect((await request(app).post(`/sessions/${session.id}/complete`).set(B).send({ content: "hi" })).status).toBe(404);
    expect((await request(app).get("/sessions").set(B)).body.sessions).toEqual([]);
  });
  it("uuid가 아닌 id는 404", async () => {
    expect((await request(app).get("/sessions/not-a-uuid").set(A)).status).toBe(404);
  });
});

describe("AI 실패", () => {
  it("질문 생성기가 fallback을 주면 그대로 대화가 이어진다", async () => {
    setup({ nextQuestion: async () => ({ question: "그 다음엔 어떻게 됐어?", choices: [], source: "fallback" }) });
    const { session } = await startSession();
    const res = await request(app).post(`/sessions/${session.id}/messages`).set(A).send({ content: "응" });
    expect(res.status).toBe(201);
    expect(res.body.aiMessage.content).toBe("그 다음엔 어떻게 됐어?");
  });
});
