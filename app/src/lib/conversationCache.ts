import type { Conversation } from "./types";

/** 메인 → 대화 화면으로 넘어갈 때 방금 받은 응답을 넘겨 주는 1회용 보관소 */
const cache = new Map<string, Conversation>();

export const conversationCache = {
  put(conversation: Conversation) {
    cache.set(conversation.session.id, conversation);
  },
  take(sessionId: string): Conversation | undefined {
    const value = cache.get(sessionId);
    cache.delete(sessionId);
    return value;
  },
};
