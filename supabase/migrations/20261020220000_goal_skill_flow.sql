alter table public.goals
  add column template_key text,
  add column is_custom boolean not null default true;

alter table public.goals
  add constraint goals_template_key_check
  check (template_key is null or template_key in ('clarity', 'negotiation', 'storytelling'));

alter table public.goals
  add constraint goals_user_template_key_unique unique (user_id, template_key);

alter table public.sessions
  add column skill_focus text not null default 'coach-choice',
  add column topic text not null default '';

alter table public.feedback_items
  add column skill text not null default '';

alter table public.exercises
  add column target_skill text not null default '',
  add column selection_reason text not null default '',
  add column source_feedback_item_id uuid references public.feedback_items(id) on delete set null,
  add column metrics jsonb not null default '{}'::jsonb,
  add column coaching jsonb not null default '{}'::jsonb;

create index exercises_source_feedback_item_id_idx
  on public.exercises(source_feedback_item_id);
