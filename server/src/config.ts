import { z } from "zod";

const boolString = z
  .enum(["true", "false"])
  .default("true")
  .transform((v) => v === "true");

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    SUPABASE_URL: z.url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    MOCK_AI: boolString,
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().optional(),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    AI_DRAFT_RETRIES: z.coerce.number().int().min(0).max(3).default(0),
    CORS_ORIGINS: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.MOCK_AI) return;
    if (!env.GEMINI_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["GEMINI_API_KEY"], message: "MOCK_AI=false 이면 필요합니다" });
    }
    if (!env.GEMINI_MODEL) {
      ctx.addIssue({ code: "custom", path: ["GEMINI_MODEL"], message: "MOCK_AI=false 이면 필요합니다" });
    }
  });

export type Config = {
  port: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  ai: { mock: true } | { mock: false; apiKey: string; model: string; timeoutMs: number; draftRetries: number };
  corsOrigins: string[];
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`환경변수 설정이 올바르지 않습니다:\n${lines.join("\n")}`);
  }
  const env = parsed.data;
  return {
    port: env.PORT,
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    ai: env.MOCK_AI
      ? { mock: true }
      : {
          mock: false,
          apiKey: env.GEMINI_API_KEY ?? "",
          model: env.GEMINI_MODEL ?? "",
          timeoutMs: env.AI_TIMEOUT_MS,
          draftRetries: env.AI_DRAFT_RETRIES,
        },
    corsOrigins: (env.CORS_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
