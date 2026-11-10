// 데모 서버(server: npm run demo)와 Expo 웹(app: npm run web)을 띄운 뒤 실행: node e2e/flow.cjs
// 데모 서버는 메모리 저장소라 실행할 때마다 다시 띄워야 같은 결과가 나온다.
const { chromium } = require('playwright');
let list0;
const OUT = require('path').join(__dirname, 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });
const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:4000';
const shot = (p, name) => p.screenshot({ path: require('path').join(OUT, `${name}.png`) });
const log = (...a) => console.log('✓', ...a);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const text = () => p.innerText('body');
  try {
    await p.goto(APP, { waitUntil: 'networkidle', timeout: 120000 });

    // 1. 로그인
    await p.getByLabel('이메일').fill('demo@hanmadi.app');
    await p.getByLabel('비밀번호 (6자 이상)').fill('hanmadi');
    await p.getByRole('button', { name: '들어가기' }).click();
    await p.getByText('오늘 가장 기억에 남는 단어 하나만 알려줄래?').waitFor();
    await shot(p, '01-main'); log('로그인 → 메인 (질문 + 한 단어 입력칸)');

    // 2. 한 단어로 시작
    await p.getByLabel('한 단어').fill('알바');
    await p.getByRole('button', { name: '시작' }).click();
    await p.getByText("'알바'", { exact: false }).first().waitFor();
    log('세션 시작, 첫 질문에 시작 단어 반영');

    // 3. 꼬리물기 3턴 (한 번은 선택지 탭)
    const answer = async (t) => {
      await p.getByLabel('한 마디만 적어도 돼').fill(t);
      await p.getByRole('button', { name: '보내기' }).click();
      await p.getByText(t, { exact: true }).waitFor();
      await p.waitForFunction(() => !document.body.innerText.includes('…'));
    };
    // 선택지(최대 3개) 중 첫 번째를 탭
    const chips = p.locator('[role=button]:visible').filter({ hasNotText: /보내기|여기까지 할래/ });
    const chip = (await chips.first().innerText()).trim();
    await chips.first().click();
    await p.waitForFunction(() => !document.body.innerText.includes('…'));
    await p.waitForTimeout(300);
    await answer('손님이 엄청 많았어');
    await answer('사장님이 커피를 사 줬어');
    await p.getByText('이 정도면 충분해').waitFor();
    await shot(p, '02-chat'); log('3턴 답변 (선택지 포함), "여기까지 할래" 권유 문구 표시');

    // 4. 서버가 죽으면? → 부드러운 안내 + 쓴 글 보존
    await p.route(API + '/**', r => r.abort('connectionrefused'));
    await p.getByLabel('한 마디만 적어도 돼').fill('이건 전송 실패할 답');
    await p.getByRole('button', { name: '보내기' }).click();
    await p.getByText('아직 전송이 안 됐어').waitFor();
    const kept = await p.getByLabel('한 마디만 적어도 돼').inputValue();
    if (kept !== '이건 전송 실패할 답') throw new Error('입력 보존 실패: ' + kept);
    await shot(p, '03-offline'); log('네트워크 오류 → 에러 화면 없이 안내, 입력 글 보존');
    await p.unroute(API + '/**');
    await p.getByLabel('한 마디만 적어도 돼').fill('');

    // 5. 여기까지 할래 → 초안 (AI 미사용, 내 답 이어 붙임)
    await p.getByRole('button', { name: '여기까지 할래' }).click();
    await p.getByText('네 답을 이어 붙였어').waitFor();
    const draft = await p.getByLabel('일기 내용').inputValue();
    if (draft !== `${chip}\n손님이 엄청 많았어\n사장님이 커피를 사 줬어`) throw new Error('초안 불일치: ' + JSON.stringify(draft));
    log('초안 = 내 답변 그대로:', JSON.stringify(draft));
    await p.getByLabel('일기 내용').fill('오늘 알바는 손님이 엄청 많았다.\n그래도 사장님이 커피를 사 줘서 뿌듯했다.');
    await shot(p, '04-edit');
    await p.getByRole('button', { name: '일기로 남기기' }).click();
    await p.getByText('그래도 사장님이 커피를 사 줘서 뿌듯했다.').waitFor();
    await shot(p, '05-diary'); log('일기 저장 → 상세 화면');

    // 6. 일기 목록
    await p.getByRole('button', { name: '내 일기' }).click();
    await p.getByText('떡볶이', { exact: true }).waitFor();
    if (list0 = await text(), list0.indexOf('알바') > list0.indexOf('떡볶이')) throw new Error('최신 일기가 위에 와야 함');
    const list = await text();
    if (!list.includes('알바') || !list.includes('떡볶이')) throw new Error('목록 누락');
    log('일기 목록: 알바 + 떡볶이(시드)');

    // 7. 중간 이탈 → 보관함 → 이어 하기
    await p.goto(APP + '/', { waitUntil: 'networkidle' });
    await p.getByLabel('한 단어').fill('비');
    await p.getByRole('button', { name: '시작' }).click();
    await answer('우산 없이 뛰었어');
    await p.goto(APP + '/', { waitUntil: 'networkidle' }); // 앱을 떠남 (저장 버튼 없음)
    await p.getByRole('link', { name: '생각의 조각' }).click();
    await p.getByText('우산 없이 뛰었어').waitFor();
    await shot(p, '06-archive'); log('보관함에 미완성 세션 카드 (비, 버스)');
    await p.getByText('우산 없이 뛰었어').click();
    await p.getByText('우산 없이 뛰었어', { exact: true }).waitFor();
    await p.getByLabel('한 마디만 적어도 돼').waitFor();
    log('카드 탭 → 대화 이어 하기');

    // 8. 로그아웃 → 로그인 화면
    await p.goto(APP + '/', { waitUntil: 'networkidle' });
    await p.getByRole('link', { name: '로그아웃' }).click();
    await p.getByText('이메일로 들어올래?').waitFor();
    log('로그아웃 → 로그인 화면');
  } catch (e) {
    process.exitCode = 1;
    await shot(p, 'FAIL');
    console.log('FAIL:', e.message.split('\n')[0]);
    console.log((await text()).slice(0, 500));
  }
  console.log('브라우저 에러:', errs.filter(e => !e.includes('ERR_CONNECTION_REFUSED') && !e.includes('Failed to load resource')));
  await b.close();
})();
