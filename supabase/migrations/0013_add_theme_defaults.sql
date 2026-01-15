-- Create a single-row table to store global theme defaults.
create table if not exists public.theme_defaults (
  id smallint primary key default 1,
  chart_palette jsonb,
  chart_style text,
  updated_at timestamptz default now()
);

alter table public.theme_defaults
  add constraint theme_defaults_single_row check (id = 1);

insert into public.theme_defaults (id, chart_palette, chart_style)
values (
  1,
  '{
    "accent": "#2f4a3d",
    "accentSoft": "#5f8b7a",
    "booleanYes": "#5ce695",
    "booleanNo": "#f98c80",
    "scaleLow": "#ffeacc",
    "scaleHigh": "#ff813d"
  }'::jsonb,
  'gradient'
)
on conflict (id) do nothing;
