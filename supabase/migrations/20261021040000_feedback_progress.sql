alter table public.feedback_items
  add column progress_status text not null default 'baseline'
  check (progress_status in ('baseline', 'resolved', 'still_happening', 'new'));
