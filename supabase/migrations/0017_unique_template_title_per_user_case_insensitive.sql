-- Enforce case-insensitive unique template titles per user
drop index if exists public.question_templates_title_per_user;
create unique index if not exists question_templates_title_per_user_ci
  on public.question_templates (created_by, lower(title));
