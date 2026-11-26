-- 003_direct_phone_auth.sql
-- Direct phone_number + password table without Supabase Auth

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  password text not null,
  created_at timestamptz not null default now()
);

-- Drop auth.users foreign key constraints so app_users.id can be used directly
alter table public.user_goals drop constraint if exists user_goals_user_id_fkey;
alter table public.daily_logs drop constraint if exists daily_logs_user_id_fkey;
alter table public.progress_photos drop constraint if exists progress_photos_user_id_fkey;
alter table public.exercises drop constraint if exists exercises_user_id_fkey;
alter table public.weekly_splits drop constraint if exists weekly_splits_user_id_fkey;
alter table public.workout_sessions drop constraint if exists workout_sessions_user_id_fkey;
alter table public.ingredients drop constraint if exists ingredients_user_id_fkey;
alter table public.saved_meals drop constraint if exists saved_meals_user_id_fkey;
alter table public.food_logs drop constraint if exists food_logs_user_id_fkey;

-- Disable RLS so client queries filtered by user_id work without Supabase Auth JWT
alter table public.app_users disable row level security;
alter table public.user_goals disable row level security;
alter table public.daily_logs disable row level security;
alter table public.progress_photos disable row level security;
alter table public.exercises disable row level security;
alter table public.weekly_splits disable row level security;
alter table public.split_exercises disable row level security;
alter table public.workout_sessions disable row level security;
alter table public.workout_session_exercises disable row level security;
alter table public.workout_sets disable row level security;
alter table public.ingredients disable row level security;
alter table public.saved_meals disable row level security;
alter table public.saved_meal_items disable row level security;
alter table public.food_logs disable row level security;
