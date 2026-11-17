import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { pickPresetQuestion, type Rng } from "./fallback.js";
import { buildPrompt, RESPONSE_JSON_SCHEMA, SYSTEM_INSTRUCTION } from "./prompt.js";
import { sanitizeModelText } from "./sanitize.js";
import type { AiTurn, QuestionInput, Questioner } from "./types.js";

/** 테스트에서 가짜로 바꿔 끼울 수 있도록 필요한 부분만 정의 */
export type GenerateFn = (args: {
  model: string;
  prompt: string;
  signal: AbortSignal;
}) => Promise<string | undefined>;

export function createGenaiGenerate(apiKey: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, prompt, signal }) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
        temperature: 0.8,
        maxOutputTokens: 2048,
        // 짧은 질문 하나라 깊게 생각할 필요가 없다. Gemini 3 이상은 생각을 최소로 해서 빨리 답하게 한다.
        ...(/^gemini-[3-9]/.test(model) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
        abortSignal: signal,
      },
    });
    return res.text;
  };
}

type Options = { model: string; timeoutMs: number; generate: GenerateFn; rng?: Rng; log?: (msg: string) => void };

export class GeminiQuestioner implements Questioner {
  constructor(private readonly opts: Options) {}

  async nextQuestion(input: QuestionInput): Promise<AiTurn> {
    const { model, timeoutMs, generate, rng = Math.random, log = console.warn } = this.opts;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await generate({ model, prompt: buildPrompt(input), signal: controller.signal });
      const clean = sanitizeModelText(text);
      if (clean) return { ...clean, source: "gemini" };
      log("[ai] 응답이 질문 규칙에 맞지 않아 미리 정한 질문으로 대체");
    } catch (err) {
      // 429, 네트워크 오류, 타임아웃 등 — 사용자에게는 에러를 보이지 않는다
      const status = err instanceof ApiError ? err.status : controller.signal.aborted ? "timeout" : "network";
      log(`[ai] Gemini 호출 실패(${status}) — 미리 정한 질문으로 대체`);
    } finally {
      clearTimeout(timer);
    }
    return pickPresetQuestion(input, "fallback", rng);
  }
}
