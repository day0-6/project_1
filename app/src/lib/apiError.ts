export type ApiErrorKind = "network" | "unauthorized" | "not_found" | "conflict" | "invalid" | "server";

/** 화면은 kind만 보고 부드러운 문구를 고른다. message는 서버가 준 한국어 안내(있으면). */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 400 && status < 500) return "invalid";
  return "server";
}

/** 서버 에러 body에서 사용자 문구를 꺼낸다 */
export function messageFromBody(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("error" in body)) return undefined;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null || !("message" in error)) return undefined;
  const message = (error as { message: unknown }).message;
  return typeof message === "string" ? message : undefined;
}
