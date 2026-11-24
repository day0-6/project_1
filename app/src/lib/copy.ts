/** 사용자에게 보이는 문구. 스트릭/연속 일수/"N일째" 같은 표현은 쓰지 않는다. */
export const copy = {
  openingQuestion: "오늘 가장 기억에 남는 단어 하나만 알려줄래?",
  oneWordPlaceholder: "한 단어",
  answerPlaceholder: "한 마디만 적어도 돼",
  send: "보내기",
  start: "시작",
  finish: "여기까지 할래",
  finishHint: "이 정도면 충분해. 더 해도 되고, 여기서 멈춰도 돼.",
  thinking: "…",
  sendFailed: "아직 전송이 안 됐어. 글은 그대로 있으니 다시 보내 볼까?",
  loadFailed: "잠깐 연결이 안 돼. 조금 뒤에 다시 해 볼까?",
  retry: "다시 해 보기",

  editTitle: { ai: "네가 한 말을 일기로 정리해 봤어. 고치고 싶은 데만 고쳐도 돼", fallback: "네가 한 말을 모아봤어. 고치고 싶은 데만 고쳐도 돼" },
  editPlaceholder: "한 줄이라도 괜찮아",
  save: "일기로 남기기",
  backToChat: "조금 더 이야기할래",
  saveFailed: "저장이 안 됐어. 글은 그대로 있으니 다시 눌러 볼까?",

  archiveTitle: "생각의 조각",
  archiveSubtitle: "멈춘 곳에서 언제든 이어 갈 수 있어.",
  archiveEmpty: "아직 조각이 없어. 단어 하나로 시작해 볼까?",
  answers: (n: number) => (n === 0 ? "단어만 남겨 둠" : `답 ${n}개`),

  diariesTitle: "내 일기",
  diariesEmpty: "아직 일기가 없어. 단어 하나면 시작할 수 있어.",
  goStart: "단어 하나로 시작하기",

  linkArchive: "생각의 조각",
  linkDiaries: "내 일기",
  signOut: "로그아웃",

  loginQuestion: "다시 만나서 반가워. 이메일로 들어올래?",
  signUpQuestion: "처음이구나. 이메일 하나면 돼.",
  email: "이메일",
  password: "비밀번호 (6자 이상)",
  login: "들어가기",
  signUp: "가입하기",
  toSignUp: "처음이야",
  toLogin: "이미 계정이 있어",
  checkEmail: "메일함에서 확인 링크를 눌러 줘. 그다음 여기서 들어오면 돼.",
  authFailed: "이메일이나 비밀번호를 다시 확인해 줄래?",
} as const;
