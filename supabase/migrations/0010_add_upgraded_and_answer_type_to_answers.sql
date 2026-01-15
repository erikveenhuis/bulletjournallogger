-- Add upgrade flag to profiles
alter table public.profiles
  add column if not exists is_upgraded boolean default false;

-- Store the answer type on answers
alter table public.answers
  add column if not exists answer_type_id uuid references public.answer_types on delete set null;

-- Backfill answer types from templates where possible
update public.answers a
set answer_type_id = qt.answer_type_id
from public.question_templates qt
where a.template_id = qt.id
  and a.answer_type_id is null;

-- Allow users to read their own templates (even if inactive)
drop policy if exists "Users can read own templates" on public.question_templates;
create policy "Users can read own templates" on public.question_templates
  for select using (created_by = auth.uid());

-- Allow upgraded users to manage their own templates
drop policy if exists "Upgraded users can manage own templates" on public.question_templates;
create policy "Upgraded users can manage own templates" on public.question_templates
  for all
  using (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_upgraded = true
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_upgraded = true
    )
  );

-- Allow upgraded users to manage their own answer types
drop policy if exists "Upgraded users can manage own answer types" on public.answer_types;
create policy "Upgraded users can manage own answer types" on public.answer_types
  for all
  using (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_upgraded = true
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_upgraded = true
    )
  );
