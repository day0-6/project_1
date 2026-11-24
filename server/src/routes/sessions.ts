import { Router } from "express";
import { z } from "zod";
import type { Drafter } from "../ai/diaryDraft.js";
import type { Questioner } from "../ai/types.js";
import { OPENING_QUESTION, type DraftSource, type Message, type Session } from "../domain.js";
import { isStopRequest, shouldSuggestFinish, toDraftInput, toQuestionInput } from "../lib/conversation.js";
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
async function logEventSafely(repo: Repository, type: Parameters<Repository["logEvent"]>[0], source?: DraftSource): Promise<void> {
  try {
    await repo.logEvent(type, source);
  } catch (err) {
    console.warn(`[events] ${type} 기록 실패`, err instanceof Error ? err.message : err);
  }
}

async function askNext(repo: Repository, questioner: Questioner, session: Session, messages: Message[]) {
  const turn = await questioner.nextQuestion(toQuestionInput(session, messages));
  // 공감 한마디와 질문을 한 메시지에 줄바꿈으로 저장 → 앱이 말풍선 여러 개로 나눠 보여 준다
  const content = turn.reaction ? `${turn.reaction}\n${turn.question}` : turn.question;
  const aiMessage = await repo.addMessage(session.id, "ai", content);
  return { aiMessage, choices: turn.choices };
}

/**
 * 일기 초안. 마지막 답 이후에 만든 초안이 있으면 그대로 쓴다 (다듬기 화면을 다시 열 때 AI를 또 부르지 않음).
 * 저장·이벤트 기록이 실패해도 초안은 돌려준다.
 */
async function suggestDraft(repo: Repository, drafter: Drafter, session: Session, messages: Message[]) {
  const lastAnswerAt = messages.filter((m) => m.role === "user").at(-1)?.created_at ?? "";
  const saved = await repo.latestSuggestion(session.id).catch(() => null);
  if (saved && saved.created_at > lastAnswerAt) return { content: saved.content, source: saved.source };

  const draft = await drafter.draft(toDraftInput(session, messages));
  try {
    await repo.addSuggestion(session.id, draft.content, draft.source);
  } catch (err) {
    console.warn("[suggestion] 초안 저장 실패", err instanceof Error ? err.message : err);
  }
  await logEventSafely(repo, "draft_generated", draft.source);
  return draft;
}

export function sessionsRouter(questioner: Questioner, drafter: Drafter): Router {
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
    // "이제 그만해": 더 묻지 않는다. 앱이 바로 다듬기 화면으로 넘어간다.
    if (isStopRequest(content)) {
      res.status(201).json({ userMessage, aiMessage: null, choices: [], suggestFinish: true, stop: true });
      return;
    }
    const messages = await repo.listMessages(session.id);
    const { aiMessage, choices } = await askNext(repo, questioner, session, messages);
    res.status(201).json({
      userMessage,
      aiMessage,
      choices,
      suggestFinish: shouldSuggestFinish(messages),
      stop: false,
    });
  });

  // "여기까지 할래": 사용자 답변만으로 정리한 일기 초안. AI가 실패해도 200 + 대체 초안.
  r.post("/:id/suggestion", async (req, res) => {
    const { repo } = ctx(req);
    const session = await loadSession(repo, idParam(req));
    if (session.status === "completed") throw alreadyCompleted();
    const messages = await repo.listMessages(session.id);
    const draft = await suggestDraft(repo, drafter, session, messages);
    res.json({ seedWord: session.seed_word, draft });
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
