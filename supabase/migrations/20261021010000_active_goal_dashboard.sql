alter table public.goals
  add column is_active_goal boolean not null default false;

with ranked_goals as (
  select
    id,
    row_number() over (
      partition by user_id
      order by
        case when template_key = 'clarity' then 0 else 1 end,
        created_at asc
    ) as goal_rank
  from public.goals
  where status = 'active'
)
update public.goals
set is_active_goal = true
from ranked_goals
where public.goals.id = ranked_goals.id
  and ranked_goals.goal_rank = 1;

create unique index goals_one_active_goal_per_user_idx
  on public.goals(user_id)
  where is_active_goal;

create or replace function public.set_active_goal(p_goal_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.goals
    where id = p_goal_id
      and user_id = (select auth.uid())
      and status = 'active'
  ) then
    raise exception 'Goal not found or unavailable.';
  end if;

  update public.goals
  set is_active_goal = false
  where user_id = (select auth.uid())
    and is_active_goal;

  update public.goals
  set is_active_goal = true
  where id = p_goal_id
    and user_id = (select auth.uid());

  return p_goal_id;
end;
$$;

revoke all on function public.set_active_goal(uuid) from public, anon;
grant execute on function public.set_active_goal(uuid) to authenticated;

alter table public.exercises
  add column duration_seconds integer not null default 0 check (duration_seconds >= 0);
