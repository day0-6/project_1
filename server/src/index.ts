import { createAi } from "./ai/index.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createSupabaseAuthenticator } from "./repo/supabase.js";

const config = loadConfig();
const app = createApp({
  authenticate: createSupabaseAuthenticator(config.supabaseUrl, config.supabaseAnonKey),
  ...createAi(config.ai),
  corsOrigins: config.corsOrigins,
});

app.listen(config.port, () => {
  const mode = config.ai.mock ? "MOCK_AI (Gemini 호출 안 함)" : `Gemini (${config.ai.model})`;
  console.log(`한 마디 서버: http://localhost:${config.port}  ·  AI: ${mode}`);
});
