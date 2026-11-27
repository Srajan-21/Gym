-- 005_single_user_rls_policies.sql
-- Keep RLS enabled and allow anon role access for the single app user

do $$
declare
  t text;
  uid uuid := 'f2e764f6-db52-47f5-a63d-29831c5bca7e';
begin
  foreach t in array array[
    'user_goals', 'daily_logs', 'progress_photos',
    'weekly_splits', 'workout_sessions', 'saved_meals', 'food_logs'
  ] loop
    execute format('drop policy if exists "single_user_access" on public.%I', t);
    execute format(
      'create policy "single_user_access" on public.%I for all to anon using (user_id = %L) with check (user_id = %L)',
      t, uid, uid
    );
  end loop;
end $$;

drop policy if exists "single_user_exercises" on public.exercises;
create policy "single_user_exercises" on public.exercises for all to anon
  using (user_id is null or user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e')
  with check (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e');

drop policy if exists "single_user_ingredients" on public.ingredients;
create policy "single_user_ingredients" on public.ingredients for all to anon
  using (user_id is null or user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e')
  with check (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e');

drop policy if exists "single_user_split_ex" on public.split_exercises;
create policy "single_user_split_ex" on public.split_exercises for all to anon
  using (true) with check (true);

drop policy if exists "single_user_wse" on public.workout_session_exercises;
create policy "single_user_wse" on public.workout_session_exercises for all to anon
  using (true) with check (true);

drop policy if exists "single_user_sets" on public.workout_sets;
create policy "single_user_sets" on public.workout_sets for all to anon
  using (true) with check (true);

drop policy if exists "single_user_smi" on public.saved_meal_items;
create policy "single_user_smi" on public.saved_meal_items for all to anon
  using (true) with check (true);
