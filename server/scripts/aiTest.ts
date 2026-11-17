// Gemini 연결 확인: 지어낸 짧은 대화로 질문 하나를 받아 본다. 사용: npm run ai-test
import { createGenaiGenerate } from "../src/ai/gemini.js";
import { buildPrompt } from "../src/ai/prompt.js";
import { sanitizeModelText } from "../src/ai/sanitize.js";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL;
if (!apiKey || !model) {
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

const started = Date.now();
try {
  const text = await createGenaiGenerate(apiKey)({ model, prompt, signal: AbortSignal.timeout(20000) });
  console.log(`\n모델: ${model} (${Date.now() - started}ms)`);
  console.log("원래 응답:", text);
  const clean = sanitizeModelText(text);
  console.log(clean ? `\n✅ 통과 → 공감: "${clean.reaction}" / 질문: "${clean.question}"` : "\n⚠️ 응답이 규칙에 안 맞아 예비 질문으로 바뀜");
} catch (err) {
  console.log(`\n❌ 실패 (${Date.now() - started}ms):`, err instanceof Error ? err.message.slice(0, 300) : String(err));
}
