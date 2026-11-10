import { ApiError } from "./apiError";

/** 에러를 사용자 문구로. 입력 검증(400) 문구는 서버 안내를 그대로, 그 외엔 부드러운 기본 문구. */
export function userMessageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.kind === "invalid") return err.message;
  return fallback;
}
