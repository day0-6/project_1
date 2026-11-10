-- 한 마디: 초기 스키마
-- 모든 테이블은 RLS로 본인(auth.uid()) 데이터만 접근 가능.
-- auth.users 삭제 시 모든 데이터가 cascade로 함께 삭제된다.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- sessions: 한 단어로 시작한 대화 하나
-- ─────────────────────────────────────────────
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  seed_word   text not null check (char_length(seed_word) between 1 and 50),
  status      text not null default 'in_progress'
              check (status in ('in_progress', 'completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index sessions_user_status_updated_idx
  on public.sessions (user_id, status, updated_at desc);

-- ─────────────────────────────────────────────
-- messages: 대화 메시지 (AI 질문 / 사용자 답)
-- ─────────────────────────────────────────────
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions (id) on delete cascade,
  role        text not null check (role in ('ai', 'user')),
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default clock_timestamp()
);

create index messages_session_created_idx
  on public.messages (session_id, created_at);

-- ─────────────────────────────────────────────
-- diaries: 사용자가 직접 다듬어 완성한 일기 (세션당 1개)
-- ─────────────────────────────────────────────
create table public.diaries (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null unique references public.sessions (id) on delete cascade,
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 10000),
  created_at  timestamptz not null default now()
);

create index diaries_user_created_idx
  on public.diaries (user_id, created_at desc);

-- ─────────────────────────────────────────────
-- events: 성공 지표(시작 대비 완성 비율) 측정용
-- ─────────────────────────────────────────────
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  type        text not null
              check (type in ('session_started', 'diary_completed', 'session_resumed')),
  created_at  timestamptz not null default now()
);

create index events_user_type_idx on public.events (user_id, type);

-- ─────────────────────────────────────────────
-- updated_at 자동 갱신
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- 메시지가 추가되면 세션의 updated_at도 갱신 (보관함 정렬용)
create or replace function public.touch_session_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$;

create trigger messages_touch_session
  after insert on public.messages
  for each row execute function public.touch_session_on_message();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.diaries  enable row level security;
alter table public.events   enable row level security;

-- sessions
create policy "sessions: select own" on public.sessions
  for select to authenticated using (user_id = auth.uid());
create policy "sessions: insert own" on public.sessions
  for insert to authenticated with check (user_id = auth.uid());
create policy "sessions: update own" on public.sessions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "sessions: delete own" on public.sessions
  for delete to authenticated using (user_id = auth.uid());

-- messages: 소유권은 부모 세션으로 판단
create policy "messages: select own" on public.messages
  for select to authenticated using (
    exists (select 1 from public.sessions s
            where s.id = messages.session_id and s.user_id = auth.uid())
  );
create policy "messages: insert own" on public.messages
  for insert to authenticated with check (
    exists (select 1 from public.sessions s
            where s.id = messages.session_id and s.user_id = auth.uid())
  );

-- diaries
create policy "diaries: select own" on public.diaries
  for select to authenticated using (user_id = auth.uid());
create policy "diaries: insert own" on public.diaries
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.sessions s
                where s.id = diaries.session_id and s.user_id = auth.uid())
  );
create policy "diaries: update own" on public.diaries
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "diaries: delete own" on public.diaries
  for delete to authenticated using (user_id = auth.uid());

-- events: 기록과 조회만 (수정/삭제 불가)
create policy "events: select own" on public.events
  for select to authenticated using (user_id = auth.uid());
create policy "events: insert own" on public.events
  for insert to authenticated with check (user_id = auth.uid());

-- 익명 사용자는 아무것도 못 한다
revoke all on public.sessions, public.messages, public.diaries, public.events from anon;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.diaries to authenticated;
grant select, insert on public.events to authenticated;
