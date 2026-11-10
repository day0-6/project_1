/** 자극이 적은 따뜻한 색. 경고색(빨강)은 쓰지 않는다. */
export const colors = {
  background: "#FBF7F0",
  surface: "#FFFFFF",
  text: "#2E2A25",
  subtle: "#7A7167",
  faint: "#B8AFA4",
  border: "#E8E0D4",
  accent: "#6B8F71",
  accentSoft: "#E4EDE4",
  aiBubble: "#FFFFFF",
  userBubble: "#E4EDE4",
  notice: "#8A6D3B",
  noticeSoft: "#F6EEDC",
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

export const font = {
  question: 24,
  body: 17,
  small: 14,
} as const;

export const radius = { md: 14, lg: 22, pill: 999 } as const;
