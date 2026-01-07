-- Add optional chart color palette to profiles so users can override graph colors.
alter table public.profiles
add column if not exists chart_palette jsonb;

comment on column public.profiles.chart_palette is 'User-selected chart colors';
