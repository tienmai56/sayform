alter table public.sessions
  alter column skill_focus set default 'all-skills';

update public.sessions
set skill_focus = 'all-skills'
where skill_focus = 'coach-choice';
