import type { Message } from "./types";

/** 대화 화면(인스타 DM 스타일) 전용 색. 앱의 나머지 화면은 theme.ts의 따뜻한 색을 쓴다. */
export const dm = {
  background: "#FFFFFF",
  aiBubble: "#EFEFEF",
  aiText: "#000000",
  userBubble: "#3797F0",
  userText: "#FFFFFF",
  meta: "#8E8E8E",
  border: "#DBDBDB",
  link: "#0095F6",
  avatar: "#F2E6FF",
  avatarText: "#7B3FF2",
} as const;

export type DmLine = {
  key: string;
  role: Message["role"];
  text: string;
  /** 같은 사람이 연달아 보낸 말풍선 묶음에서의 위치 */
  first: boolean;
  last: boolean;
};

/**
 * 메시지를 말풍선 줄로 펼친다.
 * AI 메시지는 "공감\n질문"처럼 줄바꿈으로 저장되므로 줄마다 말풍선 하나.
 */
export function toDmLines(messages: Message[]): DmLine[] {
  const lines: Omit<DmLine, "first" | "last">[] = [];
  for (const m of messages) {
    const parts = m.role === "ai" ? m.content.split("\n").map((t) => t.trim()).filter(Boolean) : [m.content];
    parts.forEach((text, i) => lines.push({ key: `${m.id}:${i}`, role: m.role, text }));
  }
  return lines.map((line, i) => ({
    ...line,
    first: lines[i - 1]?.role !== line.role,
    last: lines[i + 1]?.role !== line.role,
  }));
}

/** "오늘 오후 11:33" / "11월 10일 오후 11:33". 경과 일수 표현은 쓰지 않는다. */
export function formatChatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === now.toDateString();
  const h = d.getHours();
  const time = `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${sameDay ? "오늘" : `${d.getMonth() + 1}월 ${d.getDate()}일`} ${time}`;
}
