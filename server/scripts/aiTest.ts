// Gemini 연결 확인: 지어낸 짧은 대화로 .env의 모델을 하나씩 시험한다. 사용: npm run ai-test
import { createGenaiGenerate, modelList } from "../src/ai/gemini.js";
import { buildPrompt } from "../src/ai/prompt.js";
import { sanitizeModelText } from "../src/ai/sanitize.js";

const apiKey = process.env.GEMINI_API_KEY;
const models = modelList(process.env.GEMINI_MODEL ?? "");
if (!apiKey || models.length === 0) {
  console.log("server\\.env 에 GEMINI_API_KEY 와 GEMINI_MODEL 을 넣어 줘.");
  process.exit(1);
}

const prompt = buildPrompt({
  seedWord: "학교",
  history: [
    { role: "ai", content: "오늘 가장 기억에 남는 단어 하나만 알려줄래?" },
    { role: "user", content: "학교" },
    { role: "ai", content: "'학교' 하면 오늘 어떤 장면이 떠올라?" },
    { role: "user", content: "동아리도 하고 과제도 해서 정신없었어" },
  ],
});

const generate = createGenaiGenerate(apiKey);
for (const model of models) {
  const started = Date.now();
  try {
    const text = await generate({ model, prompt, signal: AbortSignal.timeout(20000) });
    const clean = sanitizeModelText(text);
    const ms = Date.now() - started;
    console.log(clean ? `✅ ${model} (${ms}ms) → 공감: "${clean.reaction}" / 질문: "${clean.question}"` : `⚠️ ${model} (${ms}ms) 응답이 규칙에 안 맞음: ${text}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = /"code":\s*(\d+)/.exec(msg)?.[1] ?? "";
    const hint = code === "503" ? "지금 붐빔" : code === "404" ? "쓸 수 없는 모델" : code === "429" ? "무료 한도 초과" : msg.slice(0, 150);
    console.log(`❌ ${model} (${Date.now() - started}ms) ${code} ${hint}`);
  }
}
console.log("\n✅가 하나라도 있으면 준비 끝. 서버는 앞에서부터 차례로 써 보고, 안 되면 다음 모델로 넘어가.");
