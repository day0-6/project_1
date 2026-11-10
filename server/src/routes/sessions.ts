import { Router } from "express";
import { z } from "zod";
import type { Questioner } from "../ai/types.js";
import { OPENING_QUESTION, type Message, type Session } from "../domain.js";
import { buildDraft, shouldSuggestFinish, toQuestionInput } from "../lib/conversation.js";
import { ctx, HttpError, idParam, notFound, parseBody } from "../lib/http.js";
import { SessionAlreadyCompletedError, type Repository } from "../repo/types.js";

const SeedBody = z.object({
  seedWord: z
    .string({ error: "단어를 하나 적어 줘." })
    .trim()
    .min(1, "단어를 하나 적어 줘.")
    .max(30, "조금 더 짧게, 한 단어면 충분해."),
});
const MessageBody = z.object({
  content: z
    .string({ error: "한 마디만 적어 줘." })
    .trim()
    .min(1, "한 마디만 적어 줘.")
    .max(2000, "조금 나눠서 보내 줄래?"),
});
const DiaryBody = z.object({
  content: z
    .string({ error: "한 줄이라도 남겨 줘." })
    .trim()
    .min(1, "한 줄이라도 남겨 줘.")
    .max(10000, "일기가 너무 길어요. 조금 줄여 줄래?"),
});
const ListQuery = z.object({ status: z.enum(["in_progress", "completed"]).optional() });

const alreadyCompleted = () => new HttpError(409, "already_completed", "이미 완성한 일기예요.");

async function loadSession(repo: Repository, id: string): Promise<Session> {
  const session = await repo.getSession(id);
  if (!session) throw notFound();
  return session;
}

/** 지표용 이벤트 기록은 실패해도 사용자 흐름을 막지 않는다 */
async function logEventSafely(repo: Repository, type: Parameters<Repository["logEvent"]>[0]): Promise<void> {
  try {
    await repo.logEvent(type);
  } catch (err) {
    console.warn(`[events] ${type} 기록 실패`, err instanceof Error ? err.message : err);
  }
}

async function askNext(repo: Repository, questioner: Questioner, session: Session, messages: Message[]) {
  const turn = await questioner.nextQuestion(toQuestionInput(session, messages));
  const aiMessage = await repo.addMessage(session.id, "ai", turn.question);
  return { aiMessage, choices: turn.choices };
}

export function sessionsRouter(questioner: Questioner): Router {
  const r = Router();

  // 세션 생성 + 첫 AI 질문
  r.post("/", async (req, res) => {
    const { repo } = ctx(req);
    const { seedWord } = parseBody(SeedBody, req);
    const session = await repo.createSession(seedWord);
    const opening = await repo.addMessage(session.id, "ai", OPENING_QUESTION);
    const seed = await repo.addMessage(session.id, "user", seedWord);
    await logEventSafely(repo, "session_started");
    const { aiMessage, choices } = await askNext(repo, questioner, session, [opening, seed]);
    res.status(201).json({ session, messages: [opening, seed, aiMessage], choices, suggestFinish: false });
  });

  // 보관함 / 목록
  r.get("/", async (req, res) => {
    const { repo } = ctx(req);
    const query = ListQuery.safeParse(req.query);
    if (!query.success) throw new HttpError(400, "invalid_query", "목록 조건을 확인해 주세요.");
    res.json({ sessions: await repo.listSessions(query.data.status) });
  });

  r.get("/:id", async (req, res) => {
    const { repo } = ctx(req);
    const session = await loadSession(repo, idParam(req));
    const messages = await repo.listMessages(session.id);
    res.json({ session, messages, suggestFinish: shouldSuggestFinish(messages) });
  });

  // 보관함에서 이어 하기. 마지막이 사용자 답이면(질문 생성 실패 등) 질문을 새로 붙인다.
  r.post("/:id/resume", async (req, res) => {
    const { repo } = ctx(req);
    const session = await loadSession(repo, idParam(req));
    if (session.status === "completed") throw alreadyCompleted();
    const messages = await repo.listMessages(session.id);
    await logEventSafely(repo, "session_resumed");
    let choices: string[] = [];
    if (messages.at(-1)?.role !== "ai") {
      const next = await askNext(repo, questioner, session, messages);
      messages.push(next.aiMessage);
      choices = next.choices;
    }
    res.json({ session, messages, choices, suggestFinish: shouldSuggestFinish(messages) });
  });

  // 사용자 답 저장(즉시) + 다음 질문
  r.post("/:id/messages", async (req, res) => {
    const { repo } = ctx(req);
    const session = await loadSession(repo, idParam(req));
    const { content } = parseBody(MessageBody, req);
    if (session.status === "completed") throw alreadyCompleted();
    const userMessage = await repo.addMessage(session.id, "user", content);
    const messages = await repo.listMessages(session.id);
    const { aiMessage, choices } = await askNext(repo, questioner, session, messages);
    res.status(201).json({
      userMessage,
      aiMessage,
      choices,
      suggestFinish: shouldSuggestFinish(messages),
    });
  });

  // 초안: 사용자 답변을 이어 붙임 (AI 미사용)
  r.get("/:id/draft", async (req, res) => {
    const { repo } = ctx(req);
    const session = await loadSession(repo, idParam(req));
    const messages = await repo.listMessages(session.id);
    res.json({ seedWord: session.seed_word, draft: buildDraft(session, messages) });
  });

  // 일기 저장 + completed
  r.post("/:id/complete", async (req, res) => {
    const { repo } = ctx(req);
    const session = await loadSession(repo, idParam(req));
    const { content } = parseBody(DiaryBody, req);
    if (session.status === "completed") throw alreadyCompleted();
    try {
      const diary = await repo.completeSession(session.id, content);
      res.status(201).json({ diary: { ...diary, seed_word: session.seed_word } });
    } catch (err) {
      if (err instanceof SessionAlreadyCompletedError) throw alreadyCompleted();
      throw err;
    }
  });

  return r;
}
