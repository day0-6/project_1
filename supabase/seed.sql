-- 발표·리허설용 예시 데이터 (가상의 하루. 실제 일기 아님)
-- 사용법: 앱에서 demo@hanmadi.app 계정으로 가입한 뒤, Supabase SQL Editor에서 실행.
-- 같은 계정에 다시 실행하면 기존 데모 데이터를 지우고 새로 넣는다.
do $$
declare
  v_user uuid;
  v_done uuid;
  v_paused uuid;
  v_paused2 uuid;
  v_base timestamptz := date_trunc('day', now()) - interval '2 days' + interval '21 hours';
begin
  select id into v_user from auth.users where email = 'demo@hanmadi.app';
  if v_user is null then
    raise exception '먼저 앱에서 demo@hanmadi.app 으로 가입해 주세요.';
  end if;

  delete from public.sessions where user_id = v_user;   -- messages/diaries는 cascade
  delete from public.events where user_id = v_user;

  -- 1) 완성된 일기
  insert into public.sessions (user_id, seed_word, status, created_at, updated_at)
  values (v_user, '떡볶이', 'completed', v_base, v_base + interval '6 minutes')
  returning id into v_done;

  insert into public.messages (session_id, role, content, created_at) values
    (v_done, 'ai',   '오늘 가장 기억에 남는 단어 하나만 알려줄래?', v_base),
    (v_done, 'user', '떡볶이',                                     v_base + interval '10 seconds'),
    (v_done, 'ai',   '''떡볶이'' 하면 오늘 어떤 장면이 떠올라?',     v_base + interval '12 seconds'),
    (v_done, 'user', '수업 끝나고 친구랑 학교 앞 분식집 갔어',       v_base + interval '1 minute'),
    (v_done, 'ai',   '분식집에서 제일 먼저 눈에 들어온 건 뭐였어?',  v_base + interval '62 seconds'),
    (v_done, 'user', '김이 엄청 올라오는 떡볶이 냄비',               v_base + interval '2 minutes'),
    (v_done, 'ai',   '그때 기분을 한 단어로 하면 뭐야?',             v_base + interval '122 seconds'),
    (v_done, 'user', '든든',                                       v_base + interval '3 minutes');

  insert into public.diaries (session_id, user_id, content, created_at) values
    (v_done, v_user, E'수업 끝나고 친구랑 학교 앞 분식집에 갔다.\n김이 엄청 올라오는 떡볶이 냄비가 제일 먼저 보였다.\n든든한 하루.', v_base + interval '6 minutes');

  -- 2) 중간에 멈춘 세션 → 보관함 '생각의 조각'
  insert into public.sessions (user_id, seed_word, created_at, updated_at)
  values (v_user, '버스', v_base + interval '1 day', v_base + interval '1 day 2 minutes')
  returning id into v_paused;

  insert into public.messages (session_id, role, content, created_at) values
    (v_paused, 'ai',   '오늘 가장 기억에 남는 단어 하나만 알려줄래?', v_base + interval '1 day'),
    (v_paused, 'user', '버스',                                     v_base + interval '1 day 5 seconds'),
    (v_paused, 'ai',   '''버스'', 그때 어디에 있었어?',               v_base + interval '1 day 7 seconds'),
    (v_paused, 'user', '집 가는 버스에서 창밖 보고 있었어',          v_base + interval '1 day 1 minute'),
    (v_paused, 'ai',   '창밖으로 뭐가 보였어?',                       v_base + interval '1 day 62 seconds');

  -- 3) 단어 하나만 남기고 멈춘 세션 (그것도 실패가 아님)
  insert into public.sessions (user_id, seed_word, created_at, updated_at)
  values (v_user, '고양이', v_base + interval '1 day 3 hours', v_base + interval '1 day 3 hours')
  returning id into v_paused2;

  insert into public.messages (session_id, role, content, created_at) values
    (v_paused2, 'ai',   '오늘 가장 기억에 남는 단어 하나만 알려줄래?', v_base + interval '1 day 3 hours'),
    (v_paused2, 'user', '고양이',                                   v_base + interval '1 day 3 hours 4 seconds'),
    (v_paused2, 'ai',   '''고양이'' 하면 누가 같이 떠올라?',          v_base + interval '1 day 3 hours 6 seconds');

  -- 메시지 트리거가 updated_at을 now()로 바꿨으므로 시드 시각으로 되돌림
  update public.sessions set updated_at = v_base + interval '6 minutes' where id = v_done;
  update public.sessions set updated_at = v_base + interval '1 day 62 seconds' where id = v_paused;
  update public.sessions set updated_at = v_base + interval '1 day 3 hours 6 seconds' where id = v_paused2;

  insert into public.events (user_id, type, created_at) values
    (v_user, 'session_started', v_base),
    (v_user, 'diary_completed', v_base + interval '6 minutes'),
    (v_user, 'session_started', v_base + interval '1 day'),
    (v_user, 'session_started', v_base + interval '1 day 3 hours');
end $$;
