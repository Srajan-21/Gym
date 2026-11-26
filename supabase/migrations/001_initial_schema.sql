-- 001_initial_schema.sql
-- Gym & Indian Diet Tracker Schema (Supabase PostgreSQL)

create extension if not exists "pgcrypto";

-- 1. User Goals & Macro Targets
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  goal_mode text not null default 'recomp' check (goal_mode in ('cut', 'maintain', 'bulk', 'recomp')),
  target_calories int not null default 2200,
  target_protein_g int not null default 150,
  target_carbs_g int not null default 220,
  target_fat_g int not null default 65,
  target_water_glasses int not null default 10,
  target_steps int not null default 10000,
  updated_at timestamptz not null default now()
);

-- 2. Daily Health, Weight, Water, Sleep & Steps Logs
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight_pre_kg numeric(5,2),
  weight_post_kg numeric(5,2),
  water_glasses int not null default 0,
  steps_treadmill int not null default 0,
  steps_other int not null default 0,
  sleep_time timestamptz,
  wake_time timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

-- 3. Daily Progress Photos (Cloudinary metadata)
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  cloudinary_url text not null,
  cloudinary_public_id text not null,
  pose_tag text not null default 'front' check (pose_tag in ('front', 'side', 'back', 'pump')),
  created_at timestamptz not null default now()
);

-- 4. Exercise Catalog (global + user custom)
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  primary_muscle text not null check (
    primary_muscle in (
      'chest', 'back', 'shoulders', 'biceps', 'triceps',
      'quads', 'hamstrings', 'glutes', 'calves', 'abs', 'cardio'
    )
  ),
  secondary_muscle text,
  equipment text not null default 'machine' check (
    equipment in ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other')
  ),
  created_at timestamptz not null default now()
);

-- 5. Weekly Split Planner (Mon-Sun templates)
create table if not exists public.weekly_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  split_name text not null,
  is_rest_day boolean not null default false,
  unique (user_id, day_of_week)
);

create table if not exists public.split_exercises (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.weekly_splits(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  order_index int not null default 0,
  target_sets int not null default 3,
  target_rep_range text not null default '8-12'
);

-- 6. Workout Sessions & Non-Linear Exercise Status
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  split_name text,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  order_index int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  unique (session_id, exercise_id)
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_number int not null,
  weight_kg numeric(6,2) not null default 0,
  reps int not null default 0,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'failure')),
  effort text not null default 'moderate' check (effort in ('easy', 'moderate', 'hard', 'failure')),
  logged_at timestamptz not null default now()
);

-- 7. Indian Ingredients (IFCT/NIN + Custom + Mess Dishes)
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (
    category in (
      'grain', 'dal_legume', 'dairy', 'oil_ghee', 'protein',
      'vegetable', 'fruit', 'nut_seed', 'supplement', 'mess_dish'
    )
  ),
  default_unit text not null default 'g' check (
    default_unit in ('g', 'ml', 'tbsp', 'tsp', 'roti', 'katori', 'piece', 'scoop')
  ),
  unit_grams numeric(6,2) not null default 100,
  calories_per_100g numeric(7,2) not null,
  protein_per_100g numeric(6,2) not null,
  carbs_per_100g numeric(6,2) not null,
  fat_per_100g numeric(6,2) not null,
  is_mess_dish boolean not null default false,
  created_at timestamptz not null default now()
);

-- 8. Saved Custom Meals / Recipes
create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  total_calories numeric(7,2) not null default 0,
  total_protein numeric(6,2) not null default 0,
  total_carbs numeric(6,2) not null default 0,
  total_fat numeric(6,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.saved_meals(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(7,2) not null,
  unit text not null,
  grams numeric(7,2) not null
);

-- 9. Daily Food Logs
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  meal_slot text not null default 'lunch' check (
    meal_slot in ('breakfast', 'lunch', 'dinner', 'pre_workout', 'post_workout', 'snack')
  ),
  meal_name text not null,
  oil_ghee_level text not null default 'none' check (oil_ghee_level in ('none', 'light', 'medium', 'heavy')),
  calories numeric(7,2) not null,
  protein_g numeric(6,2) not null,
  carbs_g numeric(6,2) not null,
  fat_g numeric(6,2) not null,
  logged_at timestamptz not null default now()
);

-- Indexes for fast queries
create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, log_date desc);
create index if not exists idx_food_logs_user_date on public.food_logs(user_id, log_date desc);
create index if not exists idx_workout_sessions_user_date on public.workout_sessions(user_id, log_date desc);
create index if not exists idx_progress_photos_user_date on public.progress_photos(user_id, log_date desc);

-- Enable Row Level Security (RLS)
alter table public.user_goals enable row level security;
alter table public.daily_logs enable row level security;
alter table public.progress_photos enable row level security;
alter table public.exercises enable row level security;
alter table public.weekly_splits enable row level security;
alter table public.split_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.ingredients enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;
alter table public.food_logs enable row level security;

-- RLS Policies: Direct user-owned tables
create policy "Users manage own goals" on public.user_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own daily_logs" on public.daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own progress_photos" on public.progress_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own weekly_splits" on public.weekly_splits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own workout_sessions" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own saved_meals" on public.saved_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own food_logs" on public.food_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS Policies: Global + User-owned tables (exercises, ingredients)
create policy "Read global or own exercises" on public.exercises
  for select using (user_id is null or auth.uid() = user_id);
create policy "Manage own exercises" on public.exercises
  for insert with check (auth.uid() = user_id);
create policy "Update own exercises" on public.exercises
  for update using (auth.uid() = user_id);
create policy "Delete own exercises" on public.exercises
  for delete using (auth.uid() = user_id);

create policy "Read global or own ingredients" on public.ingredients
  for select using (user_id is null or auth.uid() = user_id);
create policy "Manage own ingredients" on public.ingredients
  for insert with check (auth.uid() = user_id);
create policy "Update own ingredients" on public.ingredients
  for update using (auth.uid() = user_id);
create policy "Delete own ingredients" on public.ingredients
  for delete using (auth.uid() = user_id);

-- RLS Policies: Child tables via parent ownership
create policy "Users manage own split_exercises" on public.split_exercises
  for all using (
    exists (select 1 from public.weekly_splits s where s.id = split_id and s.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.weekly_splits s where s.id = split_id and s.user_id = auth.uid())
  );

create policy "Users manage own workout_session_exercises" on public.workout_session_exercises
  for all using (
    exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
  );

create policy "Users manage own workout_sets" on public.workout_sets
  for all using (
    exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
  );

create policy "Users manage own saved_meal_items" on public.saved_meal_items
  for all using (
    exists (select 1 from public.saved_meals sm where sm.id = meal_id and sm.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.saved_meals sm where sm.id = meal_id and sm.user_id = auth.uid())
  );
