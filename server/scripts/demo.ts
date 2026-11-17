/**
 * 로컬 데모 서버 — Supabase 없이 앱 전체 흐름을 돌려 보기 위한 개발 전용 스크립트.
 *  - API 서버 (기본 :4000): 실제 라우트 + 메모리 저장소 + mock AI
 *  - 가짜 Supabase Auth (기본 :54321): 이메일/비밀번호 로그인만 흉내
 * 데이터는 프로세스가 끝나면 사라진다. 운영에서는 절대 쓰지 않는다 (운영 진입점은 src/index.ts).
 *
 * 앱 .env:  EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
 *           EXPO_PUBLIC_SUPABASE_ANON_KEY=demo
 *           EXPO_PUBLIC_API_URL=http://localhost:4000
 * 데모 계정: demo@hanmadi.app / hanmadi
 */
import { randomUUID } from "node:crypto";
import express, { type Response } from "express";
import { MockQuestioner } from "../src/ai/mock.js";
import { createApp } from "../src/app.js";
import { MemoryRepository, MemoryStore } from "../src/repo/memory.js";
import type { Authenticator } from "../src/repo/types.js";
import { seedDemoData } from "./demoSeed.js";

const API_PORT = Number(process.env.PORT ?? 4000);
const AUTH_PORT = Number(process.env.DEMO_AUTH_PORT ?? 54321);
const APP_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:8081").split(",");

type User = { id: string; email: string; password: string };

const store = new MemoryStore();
const users = new Map<string, User>(); // email → user
const accessTokens = new Map<string, string>(); // token → userId
const refreshTokens = new Map<string, string>(); // token → userId

const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");

function issueSession(user: User) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  // JWT 모양만 갖춘 토큰 (서명 없음). 데모 서버만 이 토큰을 믿는다.
  const accessToken = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp, session_id: randomUUID() })}.demo`;
  const refreshToken = randomUUID();
  accessTokens.set(accessToken, user.id);
  refreshTokens.set(refreshToken, user.id);
  return { access_token: accessToken, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: refreshToken, user: publicUser(user) };
}

function publicUser(user: User) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email" },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function authError(res: Response, status: number, code: string, msg: string) {
  res.status(status).json({ code: status, error_code: code, msg });
}

function createUser(email: string, password: string): User {
  const user = { id: randomUUID(), email, password };
  users.set(email, user);
  return user;
}

// ── 가짜 Supabase Auth ─────────────────────────────
const auth = express();
auth.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.header("origin") ?? "*");
  res.header("Access-Control-Allow-Headers", req.header("access-control-request-headers") ?? "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
auth.use(express.json());

auth.post("/auth/v1/token", (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (req.query["grant_type"] === "refresh_token") {
    const userId = refreshTokens.get(String(body["refresh_token"]));
    const user = [...users.values()].find((u) => u.id === userId);
    if (!user) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
    res.json(issueSession(user));
    return;
  }
  const user = users.get(String(body["email"] ?? "").toLowerCase());
  if (!user || user.password !== body["password"]) return authError(res, 400, "invalid_credentials", "Invalid login credentials");
  res.json(issueSession(user));
});

auth.post("/auth/v1/signup", (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email = String(body["email"] ?? "").toLowerCase();
  const password = String(body["password"] ?? "");
  if (!email.includes("@") || password.length < 6) return authError(res, 422, "validation_failed", "Invalid email or password");
  if (users.has(email)) return authError(res, 422, "user_already_exists", "User already registered");
  res.json(issueSession(createUser(email, password)));
});

auth.get("/auth/v1/user", (req, res) => {
  const token = (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const userId = accessTokens.get(token);
  const user = [...users.values()].find((u) => u.id === userId);
  if (!user) return authError(res, 401, "bad_jwt", "invalid JWT");
  res.json(publicUser(user));
});

auth.post("/auth/v1/logout", (req, res) => {
  accessTokens.delete((req.header("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  res.sendStatus(204);
});

// ── API 서버 (실제 라우트) ─────────────────────────
const authenticate: Authenticator = async (token) => {
  const userId = accessTokens.get(token);
  return userId ? { userId, repo: new MemoryRepository(store, userId) } : null;
};

const demoUser = createUser("demo@hanmadi.app", "hanmadi");
await seedDemoData(new MemoryRepository(store, demoUser.id));
store.useRealTime();

createApp({ authenticate, questioner: new MockQuestioner(), corsOrigins: APP_ORIGINS }).listen(API_PORT, () => {
  console.log(`[demo] API     http://localhost:${API_PORT}  (메모리 저장소 + MOCK_AI)`);
});
auth.listen(AUTH_PORT, () => {
  console.log(`[demo] 가짜 Auth http://localhost:${AUTH_PORT}`);
  console.log("[demo] 데모 계정: demo@hanmadi.app / hanmadi");
});
