-- Add display options enum for questions and user overrides
do $$
begin
  if not exists (select 1 from pg_type where typname = 'question_display_option') then
    create type question_display_option as enum ('graph', 'list', 'grid', 'count');
  end if;
end$$;

-- Extend question templates with default/allowed answer types, display options, and colors
alter table public.question_templates
  add column if not exists allowed_answer_type_ids uuid[] not null default '{}'::uuid[],
  add column if not exists default_display_option question_display_option not null default 'graph',
  add column if not exists allowed_display_options question_display_option[] not null default array['graph']::question_display_option[],
  add column if not exists default_colors jsonb not null default '{}'::jsonb;

-- Ensure defaults are part of allowed sets when those sets are present
alter table public.question_templates
  add constraint question_templates_default_answer_in_allowed
  check (cardinality(allowed_answer_type_ids) = 0 or answer_type_id = any(allowed_answer_type_ids));

alter table public.question_templates
  add constraint question_templates_default_display_in_allowed
  check (cardinality(allowed_display_options) = 0 or default_display_option = any(allowed_display_options));

-- Extend user questions with per-question overrides
alter table public.user_questions
  add column if not exists answer_type_override_id uuid references public.answer_types on delete set null,
  add column if not exists display_option_override question_display_option,
  add column if not exists color_palette jsonb;

-- Ensure override display options use valid values
alter table public.user_questions
  add constraint user_questions_display_option_valid
  check (display_option_override is null or display_option_override = any(enum_range(null::question_display_option)));
