-- Remove answer type override support
alter table public.question_templates
  drop constraint if exists question_templates_default_answer_in_allowed;

alter table public.question_templates
  drop column if exists allowed_answer_type_ids;

alter table public.user_questions
  drop constraint if exists user_questions_answer_type_override_id_fkey;

alter table public.user_questions
  drop column if exists answer_type_override_id;
