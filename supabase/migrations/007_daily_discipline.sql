-- 007_daily_discipline.sql
-- Store daily discipline checkboxes in daily_logs.discipline (jsonb)

alter table public.daily_logs
  add column if not exists discipline jsonb not null default '{}'::jsonb;
