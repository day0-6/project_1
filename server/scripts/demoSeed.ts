import type { Repository } from "../src/repo/types.js";
import { OPENING_QUESTION } from "../src/domain.js";

/** 발표·리허설용 예시 데이터 (가상의 하루, 실제 일기 아님) */
export async function seedDemoData(repo: Repository): Promise<void> {
  // 완성된 일기 1개
  const done = await repo.createSession("떡볶이");
  for (const [role, content] of [
    ["ai", OPENING_QUESTION],
    ["user", "떡볶이"],
    ["ai", "'떡볶이' 하면 오늘 어떤 장면이 떠올라?"],
    ["user", "수업 끝나고 친구랑 학교 앞 분식집 갔어"],
    ["ai", "분식집에서 제일 먼저 눈에 들어온 건 뭐였어?"],
    ["user", "김이 엄청 올라오는 떡볶이 냄비"],
    ["ai", "그때 기분을 한 단어로 하면 뭐야?"],
    ["user", "든든"],
  ] as const) {
    await repo.addMessage(done.id, role, content);
  }
  await repo.logEvent("session_started");
  await repo.completeSession(
    done.id,
    "수업 끝나고 친구랑 학교 앞 분식집에 갔다.\n김이 엄청 올라오는 떡볶이 냄비가 제일 먼저 보였다.\n든든한 하루.",
  );

  // 중간에 멈춘 세션 1개 → 보관함 '생각의 조각'
  const paused = await repo.createSession("버스");
  for (const [role, content] of [
    ["ai", OPENING_QUESTION],
    ["user", "버스"],
    ["ai", "'버스', 그때 어디에 있었어?"],
    ["user", "집 가는 버스에서 창밖 보고 있었어"],
    ["ai", "창밖으로 뭐가 보였어?"],
  ] as const) {
    await repo.addMessage(paused.id, role, content);
  }
  await repo.logEvent("session_started");
}
