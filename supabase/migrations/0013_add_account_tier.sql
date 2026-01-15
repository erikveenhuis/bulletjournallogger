-- Add account tier to profiles
alter table public.profiles
  add column if not exists account_tier integer not null default 0;

-- Backfill tier based on previous upgrade flag
update public.profiles
set account_tier = case when is_upgraded = true then 1 else 0 end
where account_tier = 0 and is_upgraded = true;
