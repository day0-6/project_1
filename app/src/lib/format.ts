/** "11월 10일" 형식. 경과 일수("N일 전")는 압박이 될 수 있어 쓰지 않는다. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function preview(text: string, max = 40): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
