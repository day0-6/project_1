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
  /** 생략하면 질문용 설정 (SYSTEM_INSTRUCTION, RESPONSE_JSON_SCHEMA, 0.8) */
  systemInstruction?: string;
  responseJsonSchema?: object;
  temperature?: number;
}) => Promise<string | undefined>;

export function createGenaiGenerate(apiKey: string): GenerateFn {
  const ai = new GoogleGenAI({ apiKey });
  // 짧은 질문 하나라 깊게 생각할 필요가 없다. Gemini 3 이상은 생각을 최소로 해서 빨리 답하게 한다.
  // 모델이 이 설정을 거부(400)하면 그다음부터는 빼고 보낸다.
  const noThinkingConfig = new Set<string>();
  type Args = Parameters<GenerateFn>[0];
  const call = ({ model, prompt, signal, systemInstruction, responseJsonSchema, temperature }: Args, thinking: boolean) =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction ?? SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: responseJsonSchema ?? RESPONSE_JSON_SCHEMA,
        temperature: temperature ?? 0.8,
        maxOutputTokens: 2048,
        ...(thinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
        abortSignal: signal,
      },
    });
  return async (args) => {
    const { model } = args;
    const thinking = !noThinkingConfig.has(model) && /^gemini-[3-9]/.test(model);
    try {
      return (await call(args, thinking)).text;
    } catch (err) {
      if (!(thinking && err instanceof ApiError && err.status === 400)) throw err;
      noThinkingConfig.add(model);
      console.warn(`[ai] ${model}은 생각 최소화 설정을 받지 않아서 빼고 다시 보냄`);
      return (await call(args, false)).text;
    }
  };
}

type Options = { model: string; timeoutMs: number; generate: GenerateFn; rng?: Rng; log?: (msg: string) => void };

/** 붐비거나 느렸던 모델은 이 시간 동안 순서를 뒤로 미룬다 */
const COOLDOWN_MS = 2 * 60 * 1000;

export class GeminiQuestioner implements Questioner {
  /** 모델 이름 → 이 시각까지 뒤로 미룸 */
  private readonly coolingUntil = new Map<string, number>();

  constructor(private readonly opts: Options) {}

  /** 설정 순서를 지키되, 최근에 실패한 모델은 맨 뒤로 */
  private orderedModels(now: number): string[] {
    const all = modelList(this.opts.model);
    const ready = all.filter((m) => (this.coolingUntil.get(m) ?? 0) <= now);
    return [...ready, ...all.filter((m) => !ready.includes(m))];
  }

  async nextQuestion(input: QuestionInput): Promise<AiTurn> {
    const { rng = Math.random, log = console.warn } = this.opts;
    const prompt = buildPrompt(input);
    // 모델을 여러 개 시도해도 사용자가 너무 오래 기다리지 않게 전체 시간을 제한한다
    const deadline = Date.now() + this.opts.timeoutMs * 2;
    for (const model of this.orderedModels(Date.now())) {
      const remaining = deadline - Date.now();
      if (remaining <= 500) break;
      const result = await this.tryModel(model, prompt, log, Math.min(this.opts.timeoutMs, remaining));
      if (result === "next") {
        // 붐빔(503)·한도(429)·없음(404)·시간 초과 → 잠시 뒤로 미루고 다음 모델
        this.coolingUntil.set(model, Date.now() + COOLDOWN_MS);
        continue;
      }
      if (result) return result;
      break;
    }
    return pickPresetQuestion(input, "fallback", rng);
  }

  /** 성공하면 질문, 다음 모델을 써 볼 만하면 "next", 그 밖의 실패는 null */
  private async tryModel(model: string, prompt: string, log: (msg: string) => void, timeoutMs: number): Promise<AiTurn | "next" | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await this.opts.generate({ model, prompt, signal: controller.signal });
      const clean = sanitizeModelText(text);
      if (clean) return { ...clean, source: "gemini" };
      log("[ai] 응답이 질문 규칙에 맞지 않아 미리 정한 질문으로 대체");
      return null;
    } catch (err) {
      // 429, 네트워크 오류, 타임아웃 등 — 사용자에게는 에러를 보이지 않는다
      const status = err instanceof ApiError ? err.status : controller.signal.aborted ? "timeout" : "network";
      // 구글 오류 설명은 설정 문제를 알려 줄 뿐 사용자 글은 담지 않는다. 길면 자른다.
      const reason = err instanceof ApiError ? ` ${err.message.slice(0, 160)}` : "";
      log(`[ai] ${model} 호출 실패(${status})${reason}`);
      return status === "timeout" || (typeof status === "number" && RETRY_NEXT.has(status)) ? "next" : null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 다음 모델로 넘어가 볼 오류: 없는 모델, 한도 초과, 붐빔 */
const RETRY_NEXT = new Set([404, 429, 500, 503]);

/** GEMINI_MODEL은 쉼표로 여러 개 적을 수 있다. 앞에서부터 차례로 시도한다. */
export function modelList(value: string): string[] {
  return value.split(",").map((m) => m.trim()).filter(Boolean);
}
