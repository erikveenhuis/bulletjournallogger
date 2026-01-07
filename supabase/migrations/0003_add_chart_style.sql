-- Allow users to pick between gradient (existing) and brush (new) chart styles.
alter table public.profiles
add column if not exists chart_style text not null default 'gradient' check (chart_style in ('gradient', 'brush'));

comment on column public.profiles.chart_style is 'Preferred chart render style';
