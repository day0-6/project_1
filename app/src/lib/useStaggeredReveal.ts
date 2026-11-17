import { useEffect, useState } from "react";

/**
 * 새로 들어온 AI 말풍선을 한 줄씩 시간차를 두고 보여 준다 (사람이 입력하는 것처럼).
 * 이어 하기로 불러온 대화와 내가 보낸 말풍선은 바로 보인다.
 * fresh(방금 시작)면 마지막 내 말풍선 뒤의 AI 말풍선부터 시간차로 보여 준다.
 */
export function useStaggeredReveal<T extends { role: "ai" | "user" }>(items: T[], ready: boolean, fresh: boolean, delayMs = 750) {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!ready || shown !== null) return;
    const lastUser = items.map((i) => i.role).lastIndexOf("user");
    setShown(fresh && lastUser >= 0 ? lastUser + 1 : items.length);
  }, [ready, fresh, shown, items]);

  useEffect(() => {
    if (shown === null || shown === items.length) return;
    if (shown > items.length) {
      setShown(items.length); // 전송 실패로 말풍선이 빠진 경우
      return;
    }
    if (items[shown]?.role === "user") {
      setShown(shown + 1);
      return;
    }
    const timer = setTimeout(() => setShown((s) => (s ?? 0) + 1), delayMs);
    return () => clearTimeout(timer);
  }, [shown, items, delayMs]);

  const count = shown ?? 0;
  return { visible: items.slice(0, count), revealing: shown !== null && count < items.length };
}
