-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  timezone text default 'UTC',
  reminder_time time without time zone default '09:00',
  push_opt_in boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- Question templates (admin owned)
create type question_type as enum ('boolean', 'number', 'scale', 'text', 'emoji');

create table if not exists public.question_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories,
  title text not null,
  type question_type not null,
  meta jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- User-selected questions
create table if not exists public.user_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  template_id uuid references public.question_templates on delete cascade,
  sort_order int default 0,
  custom_label text,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (user_id, template_id)
);

-- Answers
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  template_id uuid references public.question_templates on delete set null,
  question_date date not null,
  bool_value boolean,
  number_value numeric,
  scale_value int,
  emoji_value text,
  text_value text,
  prompt_snapshot text,
  category_snapshot text,
  created_at timestamptz default now(),
  unique (user_id, template_id, question_date)
);

-- Push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz default now()
);

-- Reminder log (optional)
create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(user_id) on delete cascade,
  sent_at timestamptz default now(),
  status text,
  channel text,
  meta jsonb
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.question_templates enable row level security;
alter table public.user_questions enable row level security;
alter table public.answers enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security;

-- Profiles policies
create policy "Users can view their profile" on public.profiles
  for select using (auth.uid() = user_id);

create policy "Users can upsert their profile" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update their profile" on public.profiles
  for update using (auth.uid() = user_id);

-- Categories policies
create policy "Anyone authed can read categories" on public.categories
  for select using (auth.role() = 'authenticated');

create policy "Admins can manage categories" on public.categories
  for all using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true));

-- Question templates policies
create policy "Anyone authed can read active templates" on public.question_templates
  for select using (auth.role() = 'authenticated' and is_active = true);

create policy "Admins can manage templates" on public.question_templates
  for all using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin = true));

-- User questions policies
create policy "Users can read their questions" on public.user_questions
  for select using (auth.uid() = user_id);

create policy "Users can manage their questions" on public.user_questions
  for all using (auth.uid() = user_id);

-- Answers policies
create policy "Users can read their answers" on public.answers
  for select using (auth.uid() = user_id);

create policy "Users can manage their answers" on public.answers
  for all using (auth.uid() = user_id);

-- Push subscriptions policies
create policy "Users can read their push subscriptions" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can manage their push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id);

-- Reminder log policies (read own only)
create policy "Users can read their reminder log" on public.reminder_log
  for select using (auth.uid() = user_id);

create policy "System can insert reminder log" on public.reminder_log
  for insert with check (true);

-- Seed categories/templates (optional starter data)
insert into public.categories (id, name, description)
values
  (gen_random_uuid(), 'Food & Drinks', 'Water, alcohol, meals'),
  (gen_random_uuid(), 'Health', 'Fitness, cardio, steps'),
  (gen_random_uuid(), 'Wellbeing', 'Meditation, yoga, walks'),
  (gen_random_uuid(), 'Relations', 'Friends & family'),
  (gen_random_uuid(), 'Hobbies', 'Play, baking, shows')
on conflict do nothing;

-- Seed a few templates
insert into public.question_templates (id, category_id, title, type, meta, is_active)
select gen_random_uuid(), c.id, t.title, t.type::question_type, t.meta, true
from public.categories c
join (values
  ('Food & Drinks', 'How many cups of water?', 'number', jsonb_build_object('unit','cups')),
  ('Food & Drinks', 'How many glasses of alcohol?', 'number', jsonb_build_object('unit','glasses')),
  ('Health', 'How many steps today?', 'number', jsonb_build_object('unit','steps')),
  ('Wellbeing', 'How is your mood?', 'scale', jsonb_build_object('min',1,'max',5)),
  ('Wellbeing', 'Did you meditate?', 'boolean', '{}'::jsonb),
  ('Relations', 'Did you call a friend?', 'boolean', '{}'::jsonb),
  ('Hobbies', 'Did you make time for a hobby?', 'boolean', '{}'::jsonb)
) as t(cat, title, type, meta)
  on c.name = t.cat
on conflict do nothing;
