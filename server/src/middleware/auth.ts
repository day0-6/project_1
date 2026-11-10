import type { RequestHandler } from "express";
import { HttpError } from "../lib/http.js";
import type { AuthedContext, Authenticator } from "../repo/types.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthedContext;
  }
}

/** Authorization: Bearer <supabase access token> 를 검증한다. */
export function requireAuth(authenticate: Authenticator): RequestHandler {
  return async (req, _res, next) => {
    const header = req.header("authorization") ?? "";
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match?.[1]) throw new HttpError(401, "unauthorized", "다시 로그인해 주세요.");
    const authed = await authenticate(match[1]);
    if (!authed) throw new HttpError(401, "unauthorized", "다시 로그인해 주세요.");
    req.auth = authed;
    next();
  };
}
