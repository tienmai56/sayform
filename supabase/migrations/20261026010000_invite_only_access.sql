create table public.access_requests (
  email text primary key,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint access_requests_email_normalized check (email = lower(email))
);

create index access_requests_status_created_at_idx
  on public.access_requests(status, created_at desc);

-- Preserve access for accounts that already existed before invite-only mode.
insert into public.access_requests (email, status, approved_at)
select lower(email), 'approved', now()
from auth.users
where email is not null
on conflict (email) do nothing;

alter table public.access_requests enable row level security;

revoke all on table public.access_requests from anon, authenticated;
grant insert (email) on table public.access_requests to anon, authenticated;
grant select (email, status, created_at, approved_at) on table public.access_requests to authenticated;

create policy "Anyone can request access"
on public.access_requests
for insert
to anon, authenticated
with check (status = 'pending' and email = lower(email));

create policy "Users can read their own access status"
on public.access_requests
for select
to authenticated
using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
