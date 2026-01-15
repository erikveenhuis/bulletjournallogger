-- Remove custom answer types and keep globals only

-- Ensure global answer types exist for any custom types in use
insert into public.answer_types (name, description, type, items, meta, created_at)
select
  initcap(at.type),
  'Default ' || initcap(at.type) || ' answer type',
  at.type,
  case
    when at.type = 'boolean' then '["Yes", "No"]'::jsonb
    when at.type = 'emoji' then '["😀", "🙂", "😐", "😞", "😡"]'::jsonb
    when at.type = 'yes_no_list' then null
    else null
  end,
  case
    when at.type = 'scale' then '{"min": 1, "max": 5}'::jsonb
    else '{}'::jsonb
  end,
  now()
from (
  select distinct type
  from public.answer_types
  where created_by is not null
) at
where not exists (
  select 1
  from public.answer_types global
  where global.type = at.type
    and global.created_by is null
);

-- Remove custom templates that referenced custom answer types
delete from public.answers
where template_id in (
  select qt.id
  from public.question_templates qt
  join public.answer_types custom on qt.answer_type_id = custom.id
  where custom.created_by is not null
    and qt.created_by is not null
);

delete from public.user_questions
where template_id in (
  select qt.id
  from public.question_templates qt
  join public.answer_types custom on qt.answer_type_id = custom.id
  where custom.created_by is not null
    and qt.created_by is not null
);

delete from public.question_templates
where id in (
  select qt.id
  from public.question_templates qt
  join public.answer_types custom on qt.answer_type_id = custom.id
  where custom.created_by is not null
    and qt.created_by is not null
);

-- Remap remaining templates that referenced custom answer types
update public.question_templates qt
set answer_type_id = global.id
from public.answer_types custom
join lateral (
  select id
  from public.answer_types
  where type = custom.type
    and created_by is null
  order by created_at asc
  limit 1
) global on true
where qt.answer_type_id = custom.id
  and custom.created_by is not null;

-- Remap answers that referenced custom answer types
update public.answers a
set answer_type_id = global.id
from public.answer_types custom
join lateral (
  select id
  from public.answer_types
  where type = custom.type
    and created_by is null
  order by created_at asc
  limit 1
) global on true
where a.answer_type_id = custom.id
  and custom.created_by is not null;

-- Remove custom answer types
delete from public.answer_types
where created_by is not null;

-- Remove policies that allowed user-managed answer types
drop policy if exists "Upgraded users can manage own answer types" on public.answer_types;

-- Drop custom ownership column from answer types
alter table public.answer_types
  drop column if exists created_by;
