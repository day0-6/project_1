import type { Config } from "../config.js";
import { GeminiDrafter, MockDrafter, type Drafter } from "./diaryDraft.js";
import { createGenaiGenerate, GeminiQuestioner } from "./gemini.js";
import { MockQuestioner } from "./mock.js";
import type { Questioner } from "./types.js";

export function createAi(ai: Config["ai"]): { questioner: Questioner; drafter: Drafter } {
  if (ai.mock) return { questioner: new MockQuestioner(), drafter: new MockDrafter() };
  const generate = createGenaiGenerate(ai.apiKey);
  return {
    questioner: new GeminiQuestioner({ model: ai.model, timeoutMs: ai.timeoutMs, generate }),
    drafter: new GeminiDrafter({ model: ai.model, timeoutMs: ai.timeoutMs, generate, retries: ai.draftRetries }),
  };
}
