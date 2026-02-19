-- Performance indexes for WHERE/JOIN columns and RLS (baseline from best-practices review)
-- profiles: user_id is PK (index exists). Add partial index for admin RLS checks.
create index if not exists idx_profiles_is_admin
  on public.profiles (is_admin)
  where is_admin = true;

-- user_questions: filter by user_id and is_active
create index if not exists idx_user_questions_user_id
  on public.user_questions (user_id);
create index if not exists idx_user_questions_user_active
  on public.user_questions (user_id, is_active);
create index if not exists idx_user_questions_template_id
  on public.user_questions (template_id);

-- answers: filter by user_id, date range; join on template_id
create index if not exists idx_answers_user_id
  on public.answers (user_id);
create index if not exists idx_answers_user_date
  on public.answers (user_id, question_date);
create index if not exists idx_answers_template_id
  on public.answers (template_id);

-- push_subscriptions: filter by user_id
create index if not exists idx_push_subscriptions_user_id
  on public.push_subscriptions (user_id);

-- question_templates: category and creator filters
create index if not exists idx_question_templates_category_id
  on public.question_templates (category_id);
create index if not exists idx_question_templates_created_by
  on public.question_templates (created_by);
