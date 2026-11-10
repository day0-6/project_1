-- 일기 완성을 한 트랜잭션으로: 일기 저장 + 세션 completed + 이벤트 기록
-- security invoker이므로 RLS가 그대로 적용된다 (본인 세션만 완성 가능).
create or replace function public.complete_session(p_session_id uuid, p_content text)
returns public.diaries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.sessions;
  v_diary   public.diaries;
begin
  select * into v_session from public.sessions
   where id = p_session_id for update;

  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_session.status = 'completed' then
    raise exception 'session_already_completed' using errcode = 'P0001';
  end if;

  insert into public.diaries (session_id, user_id, content)
  values (p_session_id, v_session.user_id, p_content)
  returning * into v_diary;

  update public.sessions set status = 'completed' where id = p_session_id;
  insert into public.events (user_id, type) values (v_session.user_id, 'diary_completed');

  return v_diary;
end;
$$;

revoke all on function public.complete_session(uuid, text) from public, anon;
grant execute on function public.complete_session(uuid, text) to authenticated;
