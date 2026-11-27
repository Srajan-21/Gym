-- 006_finance_tables.sql
-- Finance accounts, transactions & monthly budget tables for single user

create table if not exists public.finance_accounts (
  id text primary key,
  user_id uuid not null,
  name text not null,
  opening_balance numeric(12,2) not null default 0,
  opening_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id text primary key,
  user_id uuid not null,
  account_id text not null default 'acc_sbi',
  type text not null check (type in ('expense', 'income', 'lent', 'received')),
  amount numeric(12,2) not null,
  category text not null,
  note text not null default '',
  person text,
  payment_mode text not null default 'UPI' check (payment_mode in ('UPI', 'Cash', 'Card')),
  log_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_budgets (
  user_id uuid primary key,
  monthly_budget numeric(12,2) not null default 15000,
  updated_at timestamptz not null default now()
);

alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_budgets enable row level security;

drop policy if exists "single_user_finance_accounts" on public.finance_accounts;
create policy "single_user_finance_accounts" on public.finance_accounts
  for all to anon
  using (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e')
  with check (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e');

drop policy if exists "single_user_finance_tx" on public.finance_transactions;
create policy "single_user_finance_tx" on public.finance_transactions
  for all to anon
  using (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e')
  with check (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e');

drop policy if exists "single_user_finance_budget" on public.finance_budgets;
create policy "single_user_finance_budget" on public.finance_budgets
  for all to anon
  using (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e')
  with check (user_id = 'f2e764f6-db52-47f5-a63d-29831c5bca7e');

grant select, insert, update, delete on public.finance_accounts to anon, authenticated;
grant select, insert, update, delete on public.finance_transactions to anon, authenticated;
grant select, insert, update, delete on public.finance_budgets to anon, authenticated;
