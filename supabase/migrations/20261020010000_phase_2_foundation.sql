create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 500),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  goal_title text not null check (char_length(goal_title) between 3 and 120),
  title text not null default 'Practice session' check (char_length(title) between 3 and 160),
  categories text[] not null default '{}',
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  average_wpm integer not null default 0 check (average_wpm >= 0),
  filler_count integer not null default 0 check (filler_count >= 0),
  takeaway text not null default '' check (char_length(takeaway) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 3 and 1000),
  transcript text not null default '',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  sequence_number integer not null check (sequence_number > 0),
  status text not null default 'created' check (status in ('created', 'queued', 'transcribing', 'analyzing', 'completed', 'failed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (session_id, sequence_number)
);

create table public.response_metrics (
  response_id uuid primary key references public.responses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_count integer not null default 0 check (word_count >= 0),
  unique_word_count integer not null default 0 check (unique_word_count >= 0),
  average_wpm integer not null default 0 check (average_wpm >= 0),
  filler_count integer not null default 0 check (filler_count >= 0),
  filler_words jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  response_id uuid not null references public.responses(id) on delete cascade,
  dimension text not null check (dimension in ('Vocabulary', 'Sentence structure', 'Communication effectiveness', 'Critical thinking', 'What worked')),
  evidence text not null default '',
  character_start integer,
  character_end integer,
  title text not null check (char_length(title) between 3 and 200),
  explanation text not null default '',
  alternatives jsonb not null default '[]'::jsonb,
  positive boolean not null default false,
  rating text check (rating is null or rating in ('helpful', 'unhelpful')),
  rating_note text check (rating_note is null or char_length(rating_note) <= 1000),
  dismissed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (response_id, title)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  response_id uuid references public.responses(id) on delete set null,
  exercise_type text not null default 'rephrase',
  title text not null check (char_length(title) between 3 and 160),
  prompt text not null check (char_length(prompt) between 3 and 1000),
  source_evidence text not null default '',
  answer_text text,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (session_id)
);

create table public.session_summaries (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null default '',
  strengths jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  recommended_exercise_id uuid references public.exercises(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  response_id uuid not null references public.responses(id) on delete cascade,
  state text not null default 'created' check (state in ('created', 'queued', 'transcribing', 'analyzing', 'completed', 'failed', 'cancelled')),
  idempotency_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create index goals_user_id_idx on public.goals(user_id);
create index sessions_user_id_created_at_idx on public.sessions(user_id, created_at desc);
create index sessions_goal_id_idx on public.sessions(goal_id);
create index responses_user_id_idx on public.responses(user_id);
create index responses_session_id_idx on public.responses(session_id);
create index response_metrics_user_id_idx on public.response_metrics(user_id);
create index feedback_items_user_id_idx on public.feedback_items(user_id);
create index feedback_items_response_id_idx on public.feedback_items(response_id);
create index exercises_user_id_idx on public.exercises(user_id);
create index exercises_session_id_idx on public.exercises(session_id);
create index session_summaries_user_id_idx on public.session_summaries(user_id);
create index analysis_jobs_user_id_idx on public.analysis_jobs(user_id);
create index analysis_jobs_response_id_idx on public.analysis_jobs(response_id);
create index analysis_jobs_state_idx on public.analysis_jobs(state, created_at);

create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.sessions for each row execute function public.set_updated_at();
create trigger responses_set_updated_at before update on public.responses for each row execute function public.set_updated_at();
create trigger feedback_items_set_updated_at before update on public.feedback_items for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises for each row execute function public.set_updated_at();
create trigger analysis_jobs_set_updated_at before update on public.analysis_jobs for each row execute function public.set_updated_at();

alter table public.goals enable row level security;
alter table public.sessions enable row level security;
alter table public.responses enable row level security;
alter table public.response_metrics enable row level security;
alter table public.feedback_items enable row level security;
alter table public.exercises enable row level security;
alter table public.session_summaries enable row level security;
alter table public.analysis_jobs enable row level security;

revoke all on table public.goals, public.sessions, public.responses, public.response_metrics, public.feedback_items, public.exercises, public.session_summaries, public.analysis_jobs from anon, authenticated;
grant select, insert, update, delete on table public.goals, public.sessions, public.responses, public.feedback_items, public.exercises to authenticated;
grant select, insert, update on table public.response_metrics, public.session_summaries to authenticated;
grant select, insert, update on table public.analysis_jobs to authenticated;

create policy "Users select own goals" on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own goals" on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own goals" on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own goals" on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users select own sessions" on public.sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own sessions" on public.sessions for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (goal_id is null or exists (select 1 from public.goals where goals.id = goal_id and goals.user_id = (select auth.uid())))
);
create policy "Users update own sessions" on public.sessions for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and (goal_id is null or exists (select 1 from public.goals where goals.id = goal_id and goals.user_id = (select auth.uid())))
);
create policy "Users delete own sessions" on public.sessions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users select own responses" on public.responses for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own responses" on public.responses for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
);
create policy "Users update own responses" on public.responses for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
);
create policy "Users delete own responses" on public.responses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users select own response metrics" on public.response_metrics for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own response metrics" on public.response_metrics for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.responses where responses.id = response_id and responses.user_id = (select auth.uid()))
);
create policy "Users update own response metrics" on public.response_metrics for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.responses where responses.id = response_id and responses.user_id = (select auth.uid()))
);

create policy "Users select own feedback" on public.feedback_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own feedback" on public.feedback_items for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.responses where responses.id = response_id and responses.user_id = (select auth.uid()))
);
create policy "Users update own feedback" on public.feedback_items for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.responses where responses.id = response_id and responses.user_id = (select auth.uid()))
);
create policy "Users delete own feedback" on public.feedback_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users select own exercises" on public.exercises for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own exercises" on public.exercises for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
  and (response_id is null or exists (
    select 1 from public.responses
    where responses.id = response_id
      and responses.user_id = (select auth.uid())
      and responses.session_id = exercises.session_id
  ))
);
create policy "Users update own exercises" on public.exercises for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
  and (response_id is null or exists (
    select 1 from public.responses
    where responses.id = response_id
      and responses.user_id = (select auth.uid())
      and responses.session_id = exercises.session_id
  ))
);
create policy "Users delete own exercises" on public.exercises for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users select own summaries" on public.session_summaries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own summaries" on public.session_summaries for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
  and (recommended_exercise_id is null or exists (
    select 1 from public.exercises
    where exercises.id = recommended_exercise_id
      and exercises.user_id = (select auth.uid())
      and exercises.session_id = session_summaries.session_id
  ))
);
create policy "Users update own summaries" on public.session_summaries for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
  and (recommended_exercise_id is null or exists (
    select 1 from public.exercises
    where exercises.id = recommended_exercise_id
      and exercises.user_id = (select auth.uid())
      and exercises.session_id = session_summaries.session_id
  ))
);

create policy "Users select own analysis jobs" on public.analysis_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own analysis jobs" on public.analysis_jobs for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
  and exists (
    select 1 from public.responses
    where responses.id = response_id
      and responses.user_id = (select auth.uid())
      and responses.session_id = analysis_jobs.session_id
  )
);
create policy "Users update own analysis jobs" on public.analysis_jobs for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.sessions where sessions.id = session_id and sessions.user_id = (select auth.uid()))
  and exists (
    select 1 from public.responses
    where responses.id = response_id
      and responses.user_id = (select auth.uid())
      and responses.session_id = analysis_jobs.session_id
  )
);
