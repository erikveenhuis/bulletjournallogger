-- Remove per-template chart colors in favor of profile/user overrides.
alter table public.question_templates
  drop column if exists default_colors;
