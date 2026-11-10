import { pickPresetQuestion } from "./fallback.js";
import type { AiTurn, QuestionInput, Questioner } from "./types.js";

/** MOCK_AI=true: Gemini를 호출하지 않고 미리 정해 둔 질문을 돌려준다. */
export class MockQuestioner implements Questioner {
  async nextQuestion(input: QuestionInput): Promise<AiTurn> {
    return pickPresetQuestion(input, "mock");
  }
}
