-- Enforce unique template titles per user
create unique index if not exists question_templates_title_per_user
  on public.question_templates (created_by, title);
