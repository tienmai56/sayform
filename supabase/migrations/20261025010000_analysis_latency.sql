alter table public.responses
  add column if not exists follow_up_question text;

alter table public.analysis_jobs
  add column if not exists timings jsonb not null default '{}'::jsonb;

alter table public.sessions
  add column if not exists summary_status text not null default 'pending';

alter table public.sessions
  drop constraint if exists sessions_summary_status_check;

alter table public.sessions
  add constraint sessions_summary_status_check
  check (summary_status in ('pending', 'processing', 'completed', 'failed'));

update public.sessions
set summary_status = 'completed'
where exists (
  select 1
  from public.session_summaries
  where session_summaries.session_id = sessions.id
);
