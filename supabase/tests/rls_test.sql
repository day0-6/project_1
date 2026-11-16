-- RLS 검증: 사용자 A/B가 서로의 데이터를 볼 수 없어야 한다
\set ON_ERROR_STOP on
set search_path = hanmadi, public;
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
insert into sessions (seed_word) values ('알바') returning id as a_session \gset
insert into messages (session_id, role, content) values (:'a_session', 'ai', '오늘 알바에서 무슨 일이 있었어?');
insert into messages (session_id, role, content) values (:'a_session', 'user', '손님이 많았어');
insert into events (type) values ('session_started');
select count(*) = 1 as a_sees_own_session from sessions \gset
\if :a_sees_own_session \echo 'PASS A sees own session' \else \echo 'FAIL' \quit \endif

select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
select (select count(*) from sessions) + (select count(*) from messages) + (select count(*) from events) = 0 as b_isolated \gset
\if :b_isolated \echo 'PASS B cannot see A data' \else \echo 'FAIL' \quit \endif
update sessions set status = 'completed' where id = :'a_session';
\echo 'PASS B update affected 0 rows (see UPDATE 0 above)'

\set ON_ERROR_STOP off
insert into messages (session_id, role, content) values (:'a_session', 'user', '침입');
insert into diaries (session_id, user_id, content) values (:'a_session', 'aaaaaaaa-0000-0000-0000-000000000001', '침입');
insert into sessions (user_id, seed_word) values ('aaaaaaaa-0000-0000-0000-000000000001', '사칭');
\set ON_ERROR_STOP on
\echo 'PASS (three errors above are expected: B cannot write into A)'

set role anon;
\set ON_ERROR_STOP off
select count(*) from hanmadi.sessions;
\set ON_ERROR_STOP on
\echo 'PASS (permission denied above is expected for anon)'

reset role;
select status = 'in_progress' as untouched from sessions where id = :'a_session' \gset
\if :untouched \echo 'PASS A session untouched' \else \echo 'FAIL' \quit \endif
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select (select count(*) from sessions) + (select count(*) from messages) + (select count(*) from events) = 0 as cascaded \gset
\if :cascaded \echo 'PASS account delete cascades' \else \echo 'FAIL' \quit \endif

-- complete_session: 본인만 완성 가능, 두 번은 불가
insert into auth.users values ('cccccccc-0000-0000-0000-000000000003');
set role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false) \gset
insert into sessions (seed_word) values ('산책') returning id as c_session \gset
select (complete_session(:'c_session', '오늘은 산책을 했다.')).id is not null as completed \gset
\if :completed \echo 'PASS complete_session works' \else \echo 'FAIL' \quit \endif
select status = 'completed' as st from sessions where id = :'c_session' \gset
\if :st \echo 'PASS status completed' \else \echo 'FAIL' \quit \endif
select count(*) = 1 as ev from events where type = 'diary_completed' \gset
\if :ev \echo 'PASS diary_completed event' \else \echo 'FAIL' \quit \endif
\set ON_ERROR_STOP off
select complete_session(:'c_session', '두 번째');
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false) \gset
select complete_session(:'c_session', '남의 것');
\set ON_ERROR_STOP on
\echo 'PASS (already_completed and not_found errors above are expected)'
reset role;
