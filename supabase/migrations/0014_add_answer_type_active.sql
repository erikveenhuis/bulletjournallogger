alter table public.answer_types
  add column if not exists is_active boolean not null default true;
