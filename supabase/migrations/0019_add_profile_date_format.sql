-- Add date format preference to profiles
alter table public.profiles
  add column if not exists date_format text default 'mdy';

update public.profiles
  set date_format = 'mdy'
  where date_format is null;

alter table public.profiles
  drop constraint if exists profiles_date_format_check;

alter table public.profiles
  add constraint profiles_date_format_check
  check (date_format in ('mdy', 'dmy', 'ymd'));

comment on column public.profiles.date_format is 'Preferred date format: mdy, dmy, ymd';
