-- Add single/multi choice answer types and remove scale/emoji/yes_no_list
insert into public.answer_types (
  id,
  name,
  description,
  type,
  items,
  meta,
  default_display_option,
  allowed_display_options,
  is_active
)
values
  (
    gen_random_uuid(),
    'Single choice',
    'Single choice questions',
    'single_choice',
    null,
    '{}'::jsonb,
    'list',
    array['list','grid','count']::question_display_option[],
    true
  ),
  (
    gen_random_uuid(),
    'Multiple choice',
    'Multiple choice questions',
    'multi_choice',
    null,
    '{}'::jsonb,
    'list',
    array['list','grid','count']::question_display_option[],
    true
  )
on conflict do nothing;

-- Ensure text answer type is active and defaults to list view
update public.answer_types
set
  is_active = true,
  default_display_option = 'list',
  allowed_display_options = array['list','grid','count']::question_display_option[]
where type = 'text';

-- Remove scale, emoji, and yes_no_list templates/questions/answers
with doomed_templates as (
  select qt.id
  from public.question_templates qt
  join public.answer_types at on qt.answer_type_id = at.id
  where at.type in ('scale', 'emoji', 'yes_no_list')
)
delete from public.answers
using doomed_templates
where public.answers.template_id = doomed_templates.id;

with doomed_templates as (
  select qt.id
  from public.question_templates qt
  join public.answer_types at on qt.answer_type_id = at.id
  where at.type in ('scale', 'emoji', 'yes_no_list')
)
delete from public.user_questions
using doomed_templates
where public.user_questions.template_id = doomed_templates.id;

with doomed_templates as (
  select qt.id
  from public.question_templates qt
  join public.answer_types at on qt.answer_type_id = at.id
  where at.type in ('scale', 'emoji', 'yes_no_list')
)
delete from public.question_templates
using doomed_templates
where public.question_templates.id = doomed_templates.id;

delete from public.answer_types
where type in ('emoji', 'yes_no_list', 'scale');
