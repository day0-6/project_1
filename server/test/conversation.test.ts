import { describe, expect, it } from "vitest";
import { isStopRequest } from "../src/lib/conversation.js";

describe("isStopRequest", () => {
  it.each(["이제 그만해", "그만", "됐어", "그만 물어봐", "질문 그만해!!", "여기까지 할래", "끝", "아니 그만하라고", "제발 그만ㅠㅠ", "Stop"])(
    "그만하자는 말: %s",
    (text) => expect(isStopRequest(text)).toBe(true),
  );
  it.each(["그만두고 싶었어", "끝나고 집에 갔어", "그만큼 바빴어", "끝내줬어", "여기까지 왔어", "됐어 이제 집에 갈래", "응", "휴식", "혹시 너 질문귀신이니??"])(
    "일기 내용일 수 있는 말: %s",
    (text) => expect(isStopRequest(text)).toBe(false),
  );
});
