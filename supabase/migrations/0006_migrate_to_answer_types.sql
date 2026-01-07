-- Extend answer_types table to support all question types
alter table public.answer_types
  add column if not exists type text,
  add column if not exists meta jsonb default '{}'::jsonb;

-- Make items nullable (not all types need items)
alter table public.answer_types
  alter column items drop not null;

-- Create default answer types for each enum value
-- We'll use a system user ID (NULL) for created_by on defaults
insert into public.answer_types (id, name, description, type, items, meta, created_by)
values
  (gen_random_uuid(), 'Boolean', 'Yes/No questions', 'boolean', '["Yes", "No"]'::jsonb, '{}'::jsonb, null),
  (gen_random_uuid(), 'Number', 'Numeric input questions', 'number', null, '{}'::jsonb, null),
  (gen_random_uuid(), 'Scale', 'Scale questions (1-5)', 'scale', null, '{"min": 1, "max": 5}'::jsonb, null),
  (gen_random_uuid(), 'Text', 'Text input questions', 'text', null, '{}'::jsonb, null),
  (gen_random_uuid(), 'Emoji', 'Emoji selection questions', 'emoji', '["😀", "🙂", "😐", "😞", "😡"]'::jsonb, '{}'::jsonb, null)
on conflict do nothing;

-- Function to get or create answer type based on question type and meta
create or replace function get_or_create_answer_type(
  p_type question_type,
  p_meta jsonb default '{}'::jsonb
) returns uuid as $$
declare
  v_answer_type_id uuid;
  v_items jsonb;
  v_meta jsonb;
begin
  -- Determine items and meta based on type
  case p_type
    when 'boolean' then
      v_items := '["Yes", "No"]'::jsonb;
      v_meta := '{}'::jsonb;
    when 'number' then
      v_items := null;
      v_meta := p_meta;
    when 'scale' then
      v_items := null;
      v_meta := jsonb_build_object(
        'min', coalesce((p_meta->>'min')::int, 1),
        'max', coalesce((p_meta->>'max')::int, 5)
      );
    when 'text' then
      v_items := null;
      v_meta := '{}'::jsonb;
    when 'emoji' then
      v_items := coalesce(p_meta->'emoji_set', '["😀", "🙂", "😐", "😞", "😡"]'::jsonb);
      v_meta := '{}'::jsonb;
    when 'yes_no_list' then
      -- This type should already have answer_type_id set, so return null
      return null;
    else
      v_items := null;
      v_meta := '{}'::jsonb;
  end case;

  -- Try to find existing answer type with matching type, items, and meta
  select id into v_answer_type_id
  from public.answer_types
  where type = p_type::text
    and (items is null and v_items is null or items = v_items)
    and meta = v_meta
  limit 1;

  -- If not found, create a new one
  if v_answer_type_id is null then
    insert into public.answer_types (name, description, type, items, meta, created_by)
    values (
      initcap(p_type::text),
      'Default ' || initcap(p_type::text) || ' answer type',
      p_type::text,
      v_items,
      v_meta,
      null
    )
    returning id into v_answer_type_id;
  end if;

  return v_answer_type_id;
end;
$$ language plpgsql;

-- Migrate existing questions
-- For questions without answer_type_id, set it based on their type
update public.question_templates qt
set answer_type_id = get_or_create_answer_type(qt.type, coalesce(qt.meta, '{}'::jsonb))
where answer_type_id is null;

-- For yes_no_list questions, they should already have answer_type_id, but ensure they do
-- If any yes_no_list questions don't have answer_type_id, we'll need to handle them separately
-- (They should have been created with answer_type_id already)

-- Make answer_type_id required
alter table public.question_templates
  alter column answer_type_id set not null;

-- Drop the type column from question_templates
alter table public.question_templates
  drop column type;

-- Clean up the helper function (must be dropped before enum)
drop function if exists get_or_create_answer_type(question_type, jsonb);

-- Drop the question_type enum (only if no other tables use it)
-- Note: We need to check if any other tables reference this enum first
drop type if exists question_type;
