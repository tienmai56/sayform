alter table public.response_metrics
  add column time_to_main_point_seconds integer
    check (time_to_main_point_seconds is null or time_to_main_point_seconds >= 0),
  add column main_point_evidence text not null default ''
    check (char_length(main_point_evidence) <= 500);
