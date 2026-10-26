alter table public.exercise_attempts
  add column if not exists processing_status text not null default 'completed';

alter table public.exercise_attempts
  drop constraint if exists exercise_attempts_processing_status_check;

alter table public.exercise_attempts
  add constraint exercise_attempts_processing_status_check
  check (processing_status in ('queued', 'transcribing', 'analyzing', 'completed', 'failed'));

alter table public.exercise_attempts
  add column if not exists next_step jsonb not null default '{}'::jsonb,
  add column if not exists last_error text,
  add column if not exists timings jsonb not null default '{}'::jsonb;
