import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { ApiError } from "./apiError";
import { conversationCache } from "./conversationCache";
import { copy } from "./copy";
import type { Message } from "./types";
import { userMessageFor } from "./userMessage";

type LoadState = "loading" | "ready" | "failed" | "completed";

export function useConversation(sessionId: string) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [seedWord, setSeedWord] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [suggestFinish, setSuggestFinish] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const tempId = useRef(0);

  const fetchConversation = useCallback(async () => {
    setLoad("loading");
    const cached = conversationCache.take(sessionId);
    try {
      // 캐시가 없으면 보관함에서 들어왔거나 새로고침 → 이어 하기
      const c = cached ?? (await api.resumeSession(sessionId));
      setSeedWord(c.session.seed_word);
      setMessages(c.messages);
      setChoices(c.choices);
      setSuggestFinish(c.suggestFinish);
      setLoad("ready");
    } catch (err) {
      setLoad(err instanceof ApiError && err.kind === "conflict" ? "completed" : "failed");
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchConversation();
  }, [fetchConversation]);

  /** 성공하면 true. 실패하면 false를 돌려주고 화면이 입력값을 되살린다. */
  const send = useCallback(
    async (content: string): Promise<boolean> => {
      const text = content.trim();
      if (!text || sending) return false;
      const optimistic: Message = {
        id: `temp-${tempId.current++}`,
        session_id: sessionId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setSending(true);
      setNotice(null);
      setChoices([]);
      setMessages((prev) => [...prev, optimistic]);
      try {
        const turn = await api.sendMessage(sessionId, text);
        setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), turn.userMessage, turn.aiMessage]);
        setChoices(turn.choices);
        setSuggestFinish(turn.suggestFinish);
        return true;
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        if (err instanceof ApiError && err.kind === "conflict") setLoad("completed");
        setNotice(userMessageFor(err, copy.sendFailed));
        return false;
      } finally {
        setSending(false);
      }
    },
    [sending, sessionId],
  );

  return { load, seedWord, messages, choices, suggestFinish, sending, notice, send, retry: fetchConversation };
}
