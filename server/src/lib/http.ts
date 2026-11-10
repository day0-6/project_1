import type { ErrorRequestHandler, Request } from "express";
import { z } from "zod";
import type { AuthedContext } from "../repo/types.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** 사용자에게 보여도 되는 한국어 문구 */
    readonly userMessage: string,
  ) {
    super(code);
  }
}

export const notFound = () => new HttpError(404, "not_found", "찾을 수 없어요.");

/** 요청 body를 스키마로 검사. 실패하면 400 */
export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new HttpError(400, "invalid_body", result.error.issues[0]?.message ?? "입력을 확인해 주세요.");
  }
  return result.data;
}

const Uuid = z.uuid();

/** 경로 파라미터 id가 uuid가 아니면 404 (DB 형식 오류를 숨김) */
export function idParam(req: Request): string {
  const raw = req.params["id"];
  const id = typeof raw === "string" ? raw : "";
  if (!Uuid.safeParse(id).success) throw notFound();
  return id;
}

/** 인증 미들웨어가 붙인 컨텍스트 */
export function ctx(req: Request): AuthedContext {
  if (!req.auth) throw new HttpError(401, "unauthorized", "다시 로그인해 주세요.");
  return req.auth;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.userMessage } });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: { code: "invalid_json", message: "입력을 확인해 주세요." } });
    return;
  }
  console.error(err instanceof Error ? err.message : err);
  res.status(500).json({ error: { code: "internal", message: "잠깐 문제가 생겼어요. 조금 뒤에 다시 해 볼까요?" } });
};
