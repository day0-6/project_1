import AsyncStorage from "@react-native-async-storage/async-storage";

/** 다듬기 화면에서 고친 글을 기기에 임시 보관. 나갔다 와도 그대로 (저장 버튼 없음). */
const key = (sessionId: string) => `hanmadi:draft:${sessionId}`;

export const localDraft = {
  async get(sessionId: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key(sessionId));
    } catch {
      return null;
    }
  },
  async set(sessionId: string, text: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key(sessionId), text);
    } catch {
      // 기기 저장 실패는 조용히 무시 (서버에는 대화가 이미 저장되어 있음)
    }
  },
  async clear(sessionId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key(sessionId));
    } catch {
      // 무시
    }
  },
};
