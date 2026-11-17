import { describe, expect, it } from "vitest";
import { cleanChoice, cleanQuestion, cleanReaction, sanitizeModelText, sanitizeTurn } from "../src/ai/sanitize.js";

describe("cleanQuestion: 질문 1개만 통과", () => {
  it.each([
    "알바에서 제일 바빴던 순간은 언제였어?",
    "손님이 많았구나. 그중에 기억나는 사람 있어?",
    "  \"그때 누구랑 있었어?\"  ",
  ])("통과: %s", (q) => {
    expect(cleanQuestion(q)).not.toBeNull();
  });

  it.each([
    ["질문이 아님", "오늘은 알바가 정말 힘들었구나."],
    ["대신 써 줌", "'오늘 알바는 힘들었다'라고 써 볼까?"],
    ["대신 써 줌 2", "이렇게 적어 보면 어때?"],
    ["예시 문장", "예를 들어 '손님이 많았다'는 어때?"],
    ["질문 2개", "누구랑 있었어? 기분은 어땠어?"],
    ["세 문장", "그랬구나. 힘들었겠다. 그때 기분은 어땠어?"],
    ["조언", "다음엔 쉬어야 해, 그렇지?"],
    ["조언 2", "사장님한테 말해야 되지 않을까?"],
    ["의료 표현", "그게 ADHD 증상 같아?"],
    ["너무 김", `${"아주 ".repeat(30)}길었어?`],
    ["줄바꿈 일기", "오늘은 알바를 했다.\n손님이 많았다.\n어땠어?"],
  ])("거부(%s)", (_label, q) => {
    expect(cleanQuestion(q)).toBeNull();
  });

  it("전각 물음표도 질문으로 인정", () => {
    expect(cleanQuestion("그때 어디였어？")).toBe("그때 어디였어?");
  });
});

describe("cleanChoice: 짧은 단어만", () => {
  it("통과", () => {
    expect(cleanChoice("뿌듯")).toBe("뿌듯");
    expect(cleanChoice("그냥 그래")).toBe("그냥 그래");
  });
  it("문장/긴 것은 거부", () => {
    expect(cleanChoice("오늘은 뿌듯했다.")).toBeNull();
    expect(cleanChoice("아주 아주 아주 좋음")).toBeNull();
    expect(cleanChoice("엄청나게길고긴단어였음")).toBeNull();
  });
});

describe("sanitizeTurn", () => {
  it("선택지는 최대 3개, 중복 제거, 부적합한 것만 버림", () => {
    const turn = sanitizeTurn({ question: "기분은 어땠어?", choices: ["좋음", "좋음", "피곤", "오늘은 좋았다.", "슬픔", "화남"] });
    expect(turn).toEqual({ reaction: "", question: "기분은 어땠어?", choices: ["좋음", "피곤", "슬픔"] });
  });
  it("형식이 다르면 null", () => {
    expect(sanitizeTurn({ text: "어땠어?" })).toBeNull();
    expect(sanitizeTurn("어땠어?")).toBeNull();
  });
  it("모델 텍스트: JSON/코드펜스 파싱", () => {
    expect(sanitizeModelText('```json\n{"question":"누구랑 갔어?","choices":[]}\n```')).toEqual({ reaction: "", question: "누구랑 갔어?", choices: [] });
    expect(sanitizeModelText("그냥 텍스트")).toBeNull();
    expect(sanitizeModelText(undefined)).toBeNull();
  });
});

describe("cleanReaction: 짧은 공감 한마디만", () => {
  it("짧은 공감은 통과", () => {
    expect(cleanReaction("헉 진짜 정신없었겠다")).toBe("헉 진짜 정신없었겠다");
    expect(cleanReaction("아 그랬구나 🥲")).toBe("아 그랬구나 🥲");
  });
  it("질문, 긴 글, 여러 문장, 조언·판단·일기 문장 제안은 버린다", () => {
    expect(cleanReaction("그랬구나?")).toBeNull();
    expect(cleanReaction("오늘 정말 많은 일이 있었구나. 수업도 듣고 동아리도 하고 바빴겠다")).toBeNull();
    expect(cleanReaction("그랬구나. 힘들었겠다")).toBeNull();
    expect(cleanReaction("오늘은 푹 쉬어야 해")).toBeNull();
    expect(cleanReaction("잘했어 정말")).toBeNull();
    expect(cleanReaction("이렇게 써 볼까")).toBeNull();
  });
  it("공감이 규칙에 안 맞으면 질문은 살리고 공감만 버린다", () => {
    const turn = sanitizeTurn({ reaction: "푹 쉬는 게 좋아", question: "오늘 제일 바빴던 순간은 언제야?", choices: [] });
    expect(turn).toEqual({ reaction: "", question: "오늘 제일 바빴던 순간은 언제야?", choices: [] });
    const ok = sanitizeTurn({ reaction: "와 하루가 꽉 찼네", question: "동아리에선 뭐 했어?", choices: [] });
    expect(ok?.reaction).toBe("와 하루가 꽉 찼네");
  });
});
