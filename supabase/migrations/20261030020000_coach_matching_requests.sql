-- Preserve legacy access approvals; new requests describe coach matching.
alter table public.access_requests
  add column "current_role" text check ("current_role" is null or char_length(trim("current_role")) between 2 and 160),
  add column company text check (company is null or char_length(trim(company)) between 2 and 160),
  add column coaching_goals text[],
  add column speaking_challenges text[],
  add column session_budget text,
  add column request_type text not null default 'legacy_access' check (request_type in ('legacy_access','coach_matching'));

alter table public.access_requests add constraint coach_matching_fields_required check (
  request_type <> 'coach_matching' or (
    "current_role" is not null and company is not null
    and coaching_goals is not null and cardinality(coaching_goals) between 1 and 6
    and speaking_challenges is not null and cardinality(speaking_challenges) between 1 and 9
    and session_budget is not null and session_budget in ('Under $30','$30–$59','$60–$99','$100–$149','$150+','Not sure yet')
  )
);
grant insert("current_role", company, coaching_goals, speaking_challenges, session_budget, request_type)
  on public.access_requests to anon, authenticated;
-- Existing SELECT policy still limits visibility to the account's own email.
grant select("current_role", company, coaching_goals, speaking_challenges, session_budget, request_type)
  on public.access_requests to authenticated;
