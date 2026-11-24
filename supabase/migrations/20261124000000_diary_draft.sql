-- 대화 종료 시 일기 초안 (POST /sessions/:id/suggestion)
--  - 초안은 messages에 role='ai', kind='suggestion'으로 저장한다. 대화 메시지는 kind='chat'.
--  - source: 초안이 AI 정리('ai')인지 답변을 이어 붙인 대체 초안('fallback')인지.
--  - events에 draft_generated를 source와 함께 남겨 AI 초안 통과율을 본다 (queries/metrics.sql).
-- 기존 행은 모두 kind='chat'이 되고, 다른 값은 바뀌지 않는다.

alter table hanmadi.messages
  add column kind text not null default 'chat' check (kind in ('chat', 'suggestion')),
  add column source text check (source in ('ai', 'fallback'));

-- 초안만 source를 가진다
alter table hanmadi.messages
  add constraint messages_suggestion_source_check
  check ((kind = 'suggestion') = (source is not null) and (kind = 'chat' or role = 'ai'));

-- 대체 초안은 답변을 모두 이어 붙이므로 대화 메시지(2000자)보다 길 수 있다. 일기 최대 길이에 맞춘다.
alter table hanmadi.messages drop constraint messages_content_check;
alter table hanmadi.messages
  add constraint messages_content_check
  check (char_length(content) between 1 and (case when kind = 'suggestion' then 10000 else 2000 end));

alter table hanmadi.events drop constraint events_type_check;
alter table hanmadi.events
  add constraint events_type_check
  check (type in ('session_started', 'diary_completed', 'session_resumed', 'draft_generated'));

alter table hanmadi.events
  add column source text check (source in ('ai', 'fallback')),
  add constraint events_source_check_type check ((type = 'draft_generated') = (source is not null));
