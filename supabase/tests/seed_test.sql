\set ON_ERROR_STOP on
set search_path = hanmadi, public;
insert into auth.users (id, email) values ('dddddddd-0000-0000-0000-000000000004', 'demo@hanmadi.app');
\i ../seed.sql
\i ../seed.sql
select (select count(*) from sessions) = 3 and (select count(*) from diaries) = 1
   and (select count(*) from messages) = 16 and (select count(*) from events) = 4 as seeded \gset
\if :seeded \echo 'PASS seed (idempotent re-run)' \else \echo 'FAIL seed counts' \quit \endif
select string_agg(seed_word, ',' order by updated_at desc) = '고양이,버스' as archive_order from sessions where status = 'in_progress' \gset
\if :archive_order \echo 'PASS archive order (newest first)' \else \echo 'FAIL archive order' \quit \endif
\i ../queries/metrics.sql
