// 내 Gemini 키로 쓸 수 있는 모델 목록을 보여 준다. 사용: npm run models
// 결과 중 하나(보통 이름에 flash가 들어간 최신 모델)를 .env의 GEMINI_MODEL에 넣는다.
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log("server\\.env 에 GEMINI_API_KEY 를 먼저 넣어 줘.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const names: string[] = [];
try {
  const pager = await ai.models.list();
  for await (const model of pager) {
    const canChat = model.supportedActions?.includes("generateContent") ?? false;
    const name = model.name?.replace(/^models\//, "");
    if (canChat && name && name.includes("flash")) names.push(name);
  }
} catch (err) {
  console.log("키 확인 실패: 키를 다시 복사해서 넣었는지 확인해 줘.");
  console.log(err instanceof Error ? err.message.slice(0, 200) : String(err));
  process.exit(1);
}

console.log("\n쓸 수 있는 flash 모델:");
for (const n of names.sort().reverse()) console.log("  " + n);
console.log("\n이 중 하나를 server\\.env 의 GEMINI_MODEL= 뒤에 넣어 줘. (preview, exp, lite가 없는 것 추천)\n");
