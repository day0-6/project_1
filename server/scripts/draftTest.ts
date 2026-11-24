// 일기 초안 확인: 답변을 넣으면 .env의 모델마다 AI가 쓴 초안과 검사 결과를 보여 준다.
// 사용: npm run draft-test                         (지어낸 예시 답변)
//       npm run draft-test -- 시작단어 답1 답2 ...   (띄어쓰기가 있는 답은 "따옴표"로 감싸기)
// 화면에만 출력하고 어디에도 저장하지 않는다. 실제 일기 대신 지어낸 답을 넣는 걸 권한다.
import { buildDraftPrompt, checkDraft, DRAFT_RESPONSE_JSON_SCHEMA, DRAFT_SYSTEM_INSTRUCTION, newWords, parseDraftText } from "../src/ai/diaryDraft.js";
import { createGenaiGenerate, modelList } from "../src/ai/gemini.js";

const apiKey = process.env.GEMINI_API_KEY;
const models = modelList(process.env.GEMINI_MODEL ?? "");
if (!apiKey || models.length === 0) {
  console.log("server\\.env 에 GEMINI_API_KEY 와 GEMINI_MODEL 을 넣어 줘.");
  process.exit(1);
}

const [seedWord = "알바", ...rest] = process.argv.slice(2);
const answers = rest.length > 0 ? rest : ["손님이 엄청 많았어", "사장님이 커피를 사 줬어", "좀 뿌듯했어"];
const input = { seedWord, answers };
console.log(`시작 단어: ${seedWord}\n답변: ${answers.map((a) => `"${a}"`).join(", ")}\n`);
console.log(`※ 서버는 첫 번째 모델(${models[0]})만 초안에 쓴다. 나머지는 비교용.\n`);

const generate = createGenaiGenerate(apiKey);
for (const model of models) {
  const started = Date.now();
  try {
    const text = await generate({
      model,
      prompt: buildDraftPrompt(input),
      signal: AbortSignal.timeout(20000),
      systemInstruction: DRAFT_SYSTEM_INSTRUCTION,
      responseJsonSchema: DRAFT_RESPONSE_JSON_SCHEMA,
      temperature: 0.2,
    });
    const ms = Date.now() - started;
    const raw = parseDraftText(text);
    if (raw === null) {
      console.log(`⚠️ ${model} (${ms}ms) JSON이 아님: ${text}\n`);
      continue;
    }
    const result = checkDraft(raw, input);
    const { added } = newWords(raw, input);
    console.log(`${result.ok ? "✅ 통과" : `❌ 탈락(${result.reason})`} ${model} (${ms}ms)`);
    console.log(`   초안: ${JSON.stringify(raw)}`);
    if (added.length > 0) console.log(`   답변에 없는 단어: ${added.join(", ")}`);
    console.log("");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = /"code":\s*(\d+)/.exec(msg)?.[1] ?? "";
    const hint = code === "503" ? "지금 붐빔" : code === "404" ? "쓸 수 없는 모델" : code === "429" ? "무료 한도 초과" : msg.slice(0, 150);
    console.log(`❌ ${model} (${Date.now() - started}ms) ${code} ${hint}\n`);
  }
}
