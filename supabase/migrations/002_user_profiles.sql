-- 002_user_profiles.sql
-- Stores user phone number profile linked to auth.users

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  phone_number text not null unique,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users manage own profile" on public.user_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
