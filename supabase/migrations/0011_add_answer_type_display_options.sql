-- Add default/allowed display options to answer types
alter table public.answer_types
  add column if not exists default_display_option question_display_option not null default 'graph',
  add column if not exists allowed_display_options question_display_option[] not null default array['graph']::question_display_option[];

alter table public.answer_types
  add constraint answer_types_default_display_in_allowed
  check (cardinality(allowed_display_options) = 0 or default_display_option = any(allowed_display_options));
