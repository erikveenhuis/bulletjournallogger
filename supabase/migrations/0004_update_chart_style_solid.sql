-- Expand chart_style to include a new "solid" option.
alter table public.profiles
  alter column chart_style drop default;

alter table public.profiles
  drop constraint if exists chart_style_check;

alter table public.profiles
  drop constraint if exists profiles_chart_style_check;

alter table public.profiles
  add constraint profiles_chart_style_check check (chart_style in ('gradient', 'brush', 'solid'));

alter table public.profiles
  alter column chart_style set default 'gradient';
