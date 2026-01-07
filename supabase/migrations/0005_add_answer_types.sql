-- Add yes_no_list to question_type enum
alter type question_type add value if not exists 'yes_no_list';

-- Create answer_types table
create table if not exists public.answer_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  items jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- Add answer_type_id to question_templates
alter table public.question_templates
  add column if not exists answer_type_id uuid references public.answer_types on delete set null;

-- Enable RLS for answer_types
alter table public.answer_types enable row level security;

-- Answer types policies
create policy "Anyone authed can read answer types" on public.answer_types
  for select using (auth.role() = 'authenticated');

create policy "Admins can manage answer types" on public.answer_types
  for all using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true));
