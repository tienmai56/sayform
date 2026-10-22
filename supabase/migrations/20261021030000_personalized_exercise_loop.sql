alter table public.exercises
  add column exercise_template_id text not null default 'E1'
    check (exercise_template_id in ('E1', 'E2', 'E3', 'E4', 'E5', 'E6')),
  add column skill_category text not null default 'S1'
    check (skill_category in ('S1', 'S2', 'S3', 'S4', 'S5', 'S6')),
  add column behavior_code text not null default 'state_main_point_first',
  add column target_behavior text not null default '',
  add column instructions jsonb not null default '[]'::jsonb,
  add column estimated_minutes integer not null default 4 check (estimated_minutes between 1 and 15),
  add column guidance text not null default '',
  add column difficulty_level integer not null default 1 check (difficulty_level between 1 and 3),
  add column status text not null default 'recommended'
    check (status in ('recommended', 'in_progress', 'completed', 'skipped', 'abandoned')),
  add column started_at timestamptz,
  add column completion_feedback jsonb not null default '{}'::jsonb;

update public.exercises
set status = 'completed'
where completed_at is not null;

create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  attempt_number integer not null check (attempt_number between 1 and 3),
  attempt_type text not null check (attempt_type in ('guided', 'transfer')),
  prompt text not null check (char_length(prompt) between 3 and 1000),
  difficulty_level integer not null default 1 check (difficulty_level between 1 and 3),
  guidance_provided text not null default '',
  transcript text not null default '',
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  metrics jsonb not null default '{}'::jsonb,
  assessment text not null default 'not_evaluated'
    check (assessment in ('pass', 'partial', 'fail', 'not_evaluated')),
  positive_feedback text not null default '',
  improvement_feedback text not null default '',
  supporting_evidence text not null default '',
  next_guidance text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exercise_id, attempt_type, attempt_number)
);

create index exercise_attempts_user_id_idx on public.exercise_attempts(user_id);
create index exercise_attempts_exercise_id_idx on public.exercise_attempts(exercise_id, created_at);
create trigger exercise_attempts_set_updated_at before update on public.exercise_attempts for each row execute function public.set_updated_at();

alter table public.exercise_attempts enable row level security;
revoke all on table public.exercise_attempts from anon, authenticated;
grant select, insert, update, delete on table public.exercise_attempts to authenticated;

create policy "Users select own exercise attempts" on public.exercise_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own exercise attempts" on public.exercise_attempts for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.exercises
      where exercises.id = exercise_id
        and exercises.user_id = (select auth.uid())
    )
  );

create policy "Users update own exercise attempts" on public.exercise_attempts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.exercises
      where exercises.id = exercise_id
        and exercises.user_id = (select auth.uid())
    )
  );

create policy "Users delete own exercise attempts" on public.exercise_attempts for delete to authenticated
  using ((select auth.uid()) = user_id);
