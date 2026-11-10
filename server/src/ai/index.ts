import type { Config } from "../config.js";
import { createGenaiGenerate, GeminiQuestioner } from "./gemini.js";
import { MockQuestioner } from "./mock.js";
import type { Questioner } from "./types.js";

export function createQuestioner(ai: Config["ai"]): Questioner {
  if (ai.mock) return new MockQuestioner();
  return new GeminiQuestioner({ model: ai.model, timeoutMs: ai.timeoutMs, generate: createGenaiGenerate(ai.apiKey) });
}
