-- Fix answer type integrity issues
-- Ensure all question templates have valid answer types

-- First, ensure we have default answer types for all types
INSERT INTO public.answer_types (id, name, description, type, items, meta, created_by)
VALUES
  (gen_random_uuid(), 'Boolean', 'Yes/No questions', 'boolean', '["Yes", "No"]'::jsonb, '{}'::jsonb, null),
  (gen_random_uuid(), 'Number', 'Numeric input questions', 'number', null, '{}'::jsonb, null),
  (gen_random_uuid(), 'Scale', 'Scale questions (1-5)', 'scale', null, '{"min": 1, "max": 5}'::jsonb, null),
  (gen_random_uuid(), 'Text', 'Text input questions', 'text', null, '{}'::jsonb, null),
  (gen_random_uuid(), 'Emoji', 'Emoji selection questions', 'emoji', '["😀", "🙂", "😐", "😞", "😡"]'::jsonb, '{}'::jsonb, null),
  (gen_random_uuid(), 'Yes/No List', 'Multiple yes/no questions', 'yes_no_list', null, '{}'::jsonb, null)
ON CONFLICT (name) DO NOTHING;

-- Create a function to get default answer type for a given type
CREATE OR REPLACE FUNCTION get_default_answer_type(p_type text) RETURNS uuid AS $$
DECLARE
  v_answer_type_id uuid;
BEGIN
  SELECT id INTO v_answer_type_id
  FROM public.answer_types
  WHERE type = p_type
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_answer_type_id IS NULL THEN
    -- Fallback: create a generic text answer type
    INSERT INTO public.answer_types (name, description, type, items, meta, created_by)
    VALUES (p_type || ' (Auto)', 'Auto-created ' || p_type || ' answer type', p_type, null, '{}'::jsonb, null)
    RETURNING id INTO v_answer_type_id;
  END IF;

  RETURN v_answer_type_id;
END;
$$ LANGUAGE plpgsql;

-- Fix question_templates with NULL answer_type_id
UPDATE public.question_templates
SET answer_type_id = get_default_answer_type('text')
WHERE answer_type_id IS NULL;

-- Fix user_questions with NULL answer_type_override_id (set to NULL explicitly to clear invalid references)
UPDATE public.user_questions
SET answer_type_override_id = NULL
WHERE answer_type_override_id IS NOT NULL
  AND answer_type_override_id NOT IN (SELECT id FROM public.answer_types);

-- Now drop the old foreign key constraints that allow NULL
ALTER TABLE public.question_templates
  DROP CONSTRAINT IF EXISTS question_templates_answer_type_id_fkey;

ALTER TABLE public.user_questions
  DROP CONSTRAINT IF EXISTS user_questions_answer_type_override_id_fkey;

-- Add new foreign key constraints that don't allow NULL on delete
ALTER TABLE public.question_templates
  ADD CONSTRAINT question_templates_answer_type_id_fkey
  FOREIGN KEY (answer_type_id) REFERENCES public.answer_types(id) ON DELETE RESTRICT;

ALTER TABLE public.user_questions
  ADD CONSTRAINT user_questions_answer_type_override_id_fkey
  FOREIGN KEY (answer_type_override_id) REFERENCES public.answer_types(id) ON DELETE SET NULL;

-- Ensure answer_type_id is NOT NULL (should already be the case)
ALTER TABLE public.question_templates
  ALTER COLUMN answer_type_id SET NOT NULL;

-- Clean up the helper function
DROP FUNCTION get_default_answer_type(text);