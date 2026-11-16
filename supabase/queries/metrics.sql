-- 성공 지표: 시작 대비 완성 비율 (SQL Editor에서 실행. 일기 내용은 보지 않고 이벤트 수만 센다)

-- 전체
select
  count(*) filter (where type = 'session_started')  as started,
  count(*) filter (where type = 'diary_completed')  as completed,
  count(*) filter (where type = 'session_resumed')  as resumed,
  round(100.0 * count(*) filter (where type = 'diary_completed')
        / nullif(count(*) filter (where type = 'session_started'), 0), 1) as completion_rate_pct,
  count(distinct user_id) as users
from hanmadi.events;

-- 주별 추이
select
  date_trunc('week', created_at)::date as week,
  count(*) filter (where type = 'session_started') as started,
  count(*) filter (where type = 'diary_completed') as completed,
  round(100.0 * count(*) filter (where type = 'diary_completed')
        / nullif(count(*) filter (where type = 'session_started'), 0), 1) as completion_rate_pct
from hanmadi.events
group by 1
order by 1 desc;

-- 이어 하기가 완성으로 이어졌는가: 한 번 이상 이어 한 사용자들의 완성률
with resumed_users as (
  select distinct user_id from hanmadi.events where type = 'session_resumed'
)
select
  count(*) filter (where e.type = 'session_started') as started,
  count(*) filter (where e.type = 'diary_completed') as completed
from hanmadi.events e join resumed_users r using (user_id);
