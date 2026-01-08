-- Clean up empty answers that shouldn't be in the database
-- This removes any answer records that have no meaningful values

DELETE FROM public.answers
WHERE
  bool_value IS NULL
  AND number_value IS NULL
  AND scale_value IS NULL
  AND emoji_value IS NULL
  AND (text_value IS NULL OR text_value = '');