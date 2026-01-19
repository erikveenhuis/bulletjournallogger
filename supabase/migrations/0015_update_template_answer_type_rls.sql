-- Align template/answer type RLS with admin-only answer types

-- Question templates
drop policy if exists "Admins can manage templates" on public.question_templates;
create policy "Admins can manage templates" on public.question_templates
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_admin = true
    )
  );

drop policy if exists "Upgraded users can manage own templates" on public.question_templates;
drop policy if exists "Users can manage own templates" on public.question_templates;
drop policy if exists "Users can create own templates" on public.question_templates;
drop policy if exists "Users can update own templates" on public.question_templates;
drop policy if exists "Users can delete own templates" on public.question_templates;

create policy "Users can create own templates" on public.question_templates
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.account_tier >= 3
    )
  );

create policy "Users can update own templates" on public.question_templates
  for update
  using (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.account_tier >= 3
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.account_tier >= 3
    )
  );

create policy "Users can delete own templates" on public.question_templates
  for delete
  using (
    created_by = auth.uid()
  );

-- Answer types
drop policy if exists "Admins can manage answer types" on public.answer_types;
create policy "Admins can manage answer types" on public.answer_types
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_admin = true
    )
  );

drop policy if exists "Upgraded users can manage own answer types" on public.answer_types;
