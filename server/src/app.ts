import cors from "cors";
import express, { type Express } from "express";
import type { Questioner } from "./ai/types.js";
import { errorHandler } from "./lib/http.js";
import { requireAuth } from "./middleware/auth.js";
import type { Authenticator } from "./repo/types.js";
import { diariesRouter } from "./routes/diaries.js";
import { sessionsRouter } from "./routes/sessions.js";

export type AppDeps = {
  authenticate: Authenticator;
  questioner: Questioner;
  corsOrigins?: string[];
};

export function createApp({ authenticate, questioner, corsOrigins = [] }: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  if (corsOrigins.length > 0) app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(requireAuth(authenticate));
  app.use("/sessions", sessionsRouter(questioner));
  app.use("/diaries", diariesRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "찾을 수 없어요." } });
  });
  app.use(errorHandler);
  return app;
}
