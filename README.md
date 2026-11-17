# 한 마디 — 회피형 ADHD를 위한 일기장

> 한 단어로 시작하면 AI는 **질문만** 던지고, 일기는 **내 문장으로** 완성한다.

멋쟁이사자처럼 14기 개인 과제.

```
AI   오늘 가장 기억에 남는 단어 하나만 알려줄래?
나   알바
AI   '알바' 하면 오늘 어떤 장면이 떠올라?
나   손님이 엄청 많았어
AI   그때 누가 옆에 있었어?        [혼자] [친구] [가족]
...                                  [여기까지 할래]
→ 내 답변을 이어 붙인 초안을 내가 직접 다듬어 저장
```

## 절대 원칙과 코드 위치

| 원칙 | 어떻게 지키나 | 코드 |
| --- | --- | --- |
| 1. AI는 일기 문장을 대신 쓰지 않는다 | AI는 **짧은 공감 한마디(30자, 물음표 없음) + 질문 1개**만 보낸다. 대화 화면은 인스타 DM처럼 말풍선을 나눠 보여 준다. 시스템 프롬프트로 지시하고, 응답은 후처리로 다시 검사한다. 공감이 규칙에 어긋나면 공감만 버린다. 질문 1개(물음표 정확히 1개, 2문장·80자 이내)와 단어 선택지 3개 이하만 통과한다. "써 볼까", "예를 들어", 조언(`~해야 해`), 의료 표현이 있으면 버리고 미리 정해 둔 질문을 쓴다. 초안은 AI 없이 내 답만 이어 붙인다 | `server/src/ai/sanitize.ts`, `prompt.ts`, `lib/conversation.ts` |
| 2. 빈 화면 없음 | 모든 화면을 질문이나 입력칸으로 시작한다. 목록이 비어 있으면 질문과 시작 버튼을 보여 준다. 답이 하나도 없으면 시작 단어를 초안으로 쓴다 | `app/src/components/ListScreen.tsx`, `buildDraft` |
| 3. 중간에 나가도 실패가 아니다 | 메시지는 보낼 때마다 서버에 저장한다. 저장 버튼이 없고, 미완성 세션은 보관함 '생각의 조각'에 남는다. 다듬던 글은 기기에 자동 보관한다 | `routes/sessions.ts`, `app/src/lib/localDraft.ts` |
| 4. 스트릭 없음 | 연속 일수, "N일째", "N일 전" 같은 문구를 쓰지 않는다. 날짜는 `11월 10일` 형식으로만 쓴다 | `app/src/lib/copy.ts`, `format.ts` |
| 5. API 키는 서버에만 | 앱에는 공개해도 되는 Supabase URL과 anon key만 넣는다. 서버도 service role 키 없이 **사용자 토큰으로** DB에 접근하므로 RLS가 그대로 적용된다 | `server/src/repo/supabase.ts` |

## 구조

```
app/        Expo (React Native, TypeScript, Expo Router)  — 화면: src/app/
server/     Express (TypeScript) + Gemini(@google/genai)
supabase/   migrations/*.sql, seed.sql, queries/metrics.sql, tests/
e2e/        Playwright 전체 흐름 시나리오
docs/       발표 시나리오
```

## 빠르게 돌려 보기 (Supabase·Gemini 없이)

`server/scripts/demo.ts`는 **개발·리허설 전용**입니다. 실제 라우트에 메모리 저장소와 mock AI를 붙이고, Supabase Auth도 흉내 냅니다. 프로세스를 끄면 데이터가 사라집니다.

```bash
cd server && npm install && npm run demo
```

```bash
cd app && npm install
printf 'EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321\nEXPO_PUBLIC_SUPABASE_ANON_KEY=demo\nEXPO_PUBLIC_API_URL=http://localhost:4000\n' > .env
npm run web
```

데모 계정: `demo@hanmadi.app` / `hanmadi` (떡볶이 일기 1개, 보관함 조각 2개가 들어 있음)

## 실제 환경 설정

### 1. Supabase
1. 프로젝트를 만든다.
2. SQL Editor에서 `supabase/migrations/`의 파일을 이름 순서대로, **파일마다 새 snippet에서** 실행한다. Supabase CLI를 쓴다면 `supabase db push`.
   - 모든 테이블은 `hanmadi` 스키마에 만든다. 다른 앱이 쓰는 프로젝트(`public.diaries` 등이 이미 있는 경우)에서도 겹치지 않는다.
   - **Project Settings → Data API → Exposed schemas**에 `hanmadi`를 추가하고 저장한다. 안 하면 서버가 테이블을 찾지 못한다.
3. Authentication → Email을 켠다. 개발 중에는 이메일 확인을 꺼 두면 바로 로그인할 수 있다.
4. (시연용) 앱에서 `demo@hanmadi.app`로 가입한 뒤 SQL Editor에서 `supabase/seed.sql`을 실행한다.

### 2. 서버
```bash
cd server
cp .env.example .env
```
`.env`에 SUPABASE_URL과 SUPABASE_ANON_KEY를 채운다.
```bash
npm install
npm run dev
```

| 변수 | 설명 |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | 토큰 검증과 사용자 범위 DB 접근에 쓴다. service role 키는 필요 없다 |
| `MOCK_AI` | 기본 `true`. Gemini를 호출하지 않고 미리 정해 둔 질문을 돌려준다 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | `MOCK_AI=false`일 때 필수. 모델명은 코드에 하드코딩하지 않는다 |
| `AI_TIMEOUT_MS` | 기본 8000. 시간이 넘으면 미리 정해 둔 질문을 쓴다 |
| `CORS_ORIGINS` | Expo 웹 개발용 Origin |

> **Gemini 비용과 데이터**: 개발 중에는 무료 티어를 쓰되 **실제 일기는 넣지 않는다.** 무료 티어 데이터는 구글 제품 개선에 쓰일 수 있다. 실사용자 테스트 전에 유료 Tier 1로 전환한다.

### 3. 앱
```bash
cd app
cp .env.example .env
```
`.env`에 Supabase URL과 anon key, 서버 주소를 채운다. 실제 기기에서 테스트한다면 서버 주소에 PC의 LAN IP를 쓴다.
```bash
npm install
npm start
```

## API

모든 요청에 `Authorization: Bearer <supabase access token>`이 필요하다. 서버가 Supabase Auth로 토큰을 검증한다.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/sessions` `{ seedWord }` | 세션 생성 + 첫 질문 (`session_started`) |
| POST | `/sessions/:id/messages` `{ content }` | 답을 즉시 저장 + 다음 질문 `{ userMessage, aiMessage, choices, suggestFinish }` |
| GET | `/sessions/:id/draft` | 내 답변을 이어 붙인 초안 (AI 미사용) |
| POST | `/sessions/:id/complete` `{ content }` | 일기 저장 + `completed` (`diary_completed`, 한 트랜잭션) |
| GET | `/sessions?status=in_progress` | 보관함 |
| GET | `/sessions/:id` | 세션 + 메시지 |
| POST | `/sessions/:id/resume` | 이어 하기 (`session_resumed`). 마지막이 내 답이면 질문을 새로 붙인다 |
| GET | `/diaries`, `/diaries/:id` | 완성된 일기 |

AI 호출이 실패하면(429, 네트워크 오류, 타임아웃, 규칙 위반 응답) 미리 정해 둔 질문 중 아직 안 한 것을 고른다. 사용자에게는 에러가 보이지 않는다.

## 테스트

```bash
cd server && npm test
```
API, 후처리, Gemini 실패 처리를 다루는 테스트 42개.

```bash
cd app && npm run typecheck
```

```bash
sudo -u postgres supabase/tests/run.sh
```
로컬 Postgres에서 마이그레이션, RLS, cascade, 시드를 검증한다. 각 명령은 저장소 루트에서 실행한다.

```bash
node e2e/flow.cjs
```
`npm run demo`와 `npm run web`을 띄운 상태에서 실행한다 (Playwright 필요).

## 성공 지표

`supabase/queries/metrics.sql`로 **시작 대비 완성 비율**을 본다. 일기 내용은 보지 않고 이벤트 수만 센다. 이 수치는 사용자에게 보여 주지 않는다 (원칙 4).

## 개인정보

- 서버 로그에는 메시지나 일기 내용을 남기지 않는다. 오류 코드만 기록한다.
- 계정을 삭제하면(`auth.users`) 세션, 메시지, 일기, 이벤트가 모두 cascade로 삭제된다.
