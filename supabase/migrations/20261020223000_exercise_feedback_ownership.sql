drop policy if exists "Users insert own exercises" on public.exercises;
drop policy if exists "Users update own exercises" on public.exercises;

create policy "Users insert own exercises" on public.exercises for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.sessions
    where sessions.id = session_id
      and sessions.user_id = (select auth.uid())
  )
  and (response_id is null or exists (
    select 1 from public.responses
    where responses.id = response_id
      and responses.user_id = (select auth.uid())
      and responses.session_id = exercises.session_id
  ))
  and (source_feedback_item_id is null or exists (
    select 1
    from public.feedback_items
    join public.responses on responses.id = feedback_items.response_id
    where feedback_items.id = source_feedback_item_id
      and feedback_items.user_id = (select auth.uid())
      and responses.session_id = exercises.session_id
  ))
);

create policy "Users update own exercises" on public.exercises for update to authenticated using (
  (select auth.uid()) = user_id
) with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.sessions
    where sessions.id = session_id
      and sessions.user_id = (select auth.uid())
  )
  and (response_id is null or exists (
    select 1 from public.responses
    where responses.id = response_id
      and responses.user_id = (select auth.uid())
      and responses.session_id = exercises.session_id
  ))
  and (source_feedback_item_id is null or exists (
    select 1
    from public.feedback_items
    join public.responses on responses.id = feedback_items.response_id
    where feedback_items.id = source_feedback_item_id
      and feedback_items.user_id = (select auth.uid())
      and responses.session_id = exercises.session_id
  ))
);
