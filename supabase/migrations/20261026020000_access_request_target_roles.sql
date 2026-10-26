alter table public.access_requests
add column target_roles text;

alter table public.access_requests
add constraint access_requests_target_roles_length
check (
  target_roles is null
  or char_length(trim(target_roles)) between 2 and 160
);

grant insert (target_roles) on table public.access_requests to anon, authenticated;
grant select (target_roles) on table public.access_requests to authenticated;
