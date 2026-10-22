alter table public.feedback_items
  add column corrections jsonb not null default '[]'::jsonb;
