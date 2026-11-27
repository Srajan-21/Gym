import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCachedJson, getTodayDateString, setCachedJson } from '../lib/storage';
import { supabase } from '../lib/supabase';

export type TxType = 'expense' | 'income' | 'lent' | 'received';
export type PaymentMode = 'UPI' | 'Cash' | 'Card';

export const EXPENSE_CATEGORIES = [
  'Food / Mess',
  'Coffee / Chai',
  'Rent',
  'Bills',
  'Travel / Auto',
  'Gym / Supp',
  'Shopping',
  'Other',
] as const;

export interface FinanceAccount {
  id: string;
  name: string;
  openingBalance: number;
  openingDate: string; // YYYY-MM-DD (closing balance as of this date)
}

export interface FinanceTx {
  id: string;
  accountId: string;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  person?: string;
  paymentMode: PaymentMode;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface PersonBalance {
  person: string;
  lent: number;
  received: number;
  net: number;
}

const DEFAULT_ACCOUNTS: FinanceAccount[] = [
  {
    id: 'acc_sbi',
    name: 'SBI',
    openingBalance: 2280.67,
    openingDate: '2026-11-27',
  },
];

const INITIAL_SEED_TXS: FinanceTx[] = [
  {
    id: 'tx_seed_20261127_1',
    accountId: 'acc_sbi',
    type: 'expense',
    amount: 20,
    category: 'Travel / Auto',
    note: 'Rickshaw to office',
    paymentMode: 'UPI',
    date: '2026-11-27',
    createdAt: '2026-11-27T04:30:00.000Z',
  },
  {
    id: 'tx_seed_20261127_2',
    accountId: 'acc_sbi',
    type: 'expense',
    amount: 110,
    category: 'Food / Mess',
    note: 'Egg fried rice canteen',
    paymentMode: 'UPI',
    date: '2026-11-27',
    createdAt: '2026-11-27T08:00:00.000Z',
  },
];

export function useFinance() {
  const { user } = useAuth();
  const txKey = `gym_finance_tx_${user.id}_v1`;
  const accKey = `gym_finance_accounts_${user.id}_v1`;
  const budgetKey = `gym_finance_budget_${user.id}_v1`;

  const [accounts, setAccounts] = useState<FinanceAccount[]>(DEFAULT_ACCOUNTS);
  const [transactions, setTransactions] = useState<FinanceTx[]>(INITIAL_SEED_TXS);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(15000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cachedTx, cachedAcc, cachedBudget] = await Promise.all([
        getCachedJson<FinanceTx[]>(txKey),
        getCachedJson<FinanceAccount[]>(accKey),
        getCachedJson<number>(budgetKey),
      ]);
      if (!cancelled) {
        if (cachedTx && cachedTx.length > 0) setTransactions(cachedTx);
        if (cachedAcc && cachedAcc.length > 0) setAccounts(cachedAcc);
        if (typeof cachedBudget === 'number' && cachedBudget > 0) {
          setMonthlyBudget(cachedBudget);
        }
      }

      try {
        const [{ data: accRows }, { data: txRows }, { data: budgetRow }] = await Promise.all([
          supabase
            .from('finance_accounts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('finance_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('finance_budgets')
            .select('monthly_budget')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (!cancelled && accRows && accRows.length > 0) {
          const mappedAcc: FinanceAccount[] = accRows.map((a) => ({
            id: a.id,
            name: a.name,
            openingBalance: Number(a.opening_balance),
            openingDate: a.opening_date,
          }));
          setAccounts(mappedAcc);
          await setCachedJson(accKey, mappedAcc);
        } else if (!cancelled && accRows && accRows.length === 0) {
          // Seed SBI account on first sync if table exists & is empty
          await supabase.from('finance_accounts').upsert(
            DEFAULT_ACCOUNTS.map((a) => ({
              id: a.id,
              user_id: user.id,
              name: a.name,
              opening_balance: a.openingBalance,
              opening_date: a.openingDate,
            }))
          );
        }

        if (!cancelled && txRows && txRows.length > 0) {
          const mapped: FinanceTx[] = txRows.map((r) => ({
            id: r.id,
            accountId: r.account_id ?? 'acc_sbi',
            type: r.type as TxType,
            amount: Number(r.amount),
            category: r.category,
            note: r.note ?? '',
            person: r.person ?? undefined,
            paymentMode: (r.payment_mode ?? 'UPI') as PaymentMode,
            date: r.log_date,
            createdAt: r.created_at,
          }));
          setTransactions(mapped);
          await setCachedJson(txKey, mapped);
        } else if (!cancelled && txRows && txRows.length === 0) {
          await supabase.from('finance_transactions').upsert(
            INITIAL_SEED_TXS.map((tx) => ({
              id: tx.id,
              user_id: user.id,
              account_id: tx.accountId,
              type: tx.type,
              amount: tx.amount,
              category: tx.category,
              note: tx.note,
              person: tx.person ?? null,
              payment_mode: tx.paymentMode,
              log_date: tx.date,
              created_at: tx.createdAt,
            }))
          );
        }

        if (!cancelled && budgetRow?.monthly_budget != null) {
          const b = Number(budgetRow.monthly_budget);
          setMonthlyBudget(b);
          await setCachedJson(budgetKey, b);
        }
      } catch {
        // Fallback to AsyncStorage cache if offline
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accKey, budgetKey, txKey, user.id]);

  const addAccount = useCallback(
    async (name: string, openingBalance: number, openingDate: string) => {
      const acc: FinanceAccount = {
        id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: name.trim(),
        openingBalance: Math.round(openingBalance * 100) / 100,
        openingDate,
      };
      const next = [...accounts, acc];
      setAccounts(next);
      await setCachedJson(accKey, next);
      await supabase.from('finance_accounts').insert({
        id: acc.id,
        user_id: user.id,
        name: acc.name,
        opening_balance: acc.openingBalance,
        opening_date: acc.openingDate,
      });
      return acc;
    },
    [accKey, accounts, user.id]
  );

  const updateAccountBalance = useCallback(
    async (accountId: string, newBalance: number, asOfDate: string) => {
      const rounded = Math.round(newBalance * 100) / 100;
      const next = accounts.map((a) =>
        a.id === accountId ? { ...a, openingBalance: rounded, openingDate: asOfDate } : a
      );
      setAccounts(next);
      await setCachedJson(accKey, next);
      await supabase
        .from('finance_accounts')
        .update({ opening_balance: rounded, opening_date: asOfDate })
        .eq('id', accountId);
    },
    [accKey, accounts]
  );

  const addTransaction = useCallback(
    async (params: {
      accountId?: string;
      type: TxType;
      amount: number;
      category: string;
      note?: string;
      person?: string;
      paymentMode: PaymentMode;
      date?: string;
    }) => {
      const tx: FinanceTx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        accountId: params.accountId ?? accounts[0]?.id ?? 'acc_sbi',
        type: params.type,
        amount: Math.round(params.amount * 100) / 100,
        category: params.category,
        note: (params.note ?? '').trim(),
        person: params.person?.trim() || undefined,
        paymentMode: params.paymentMode,
        date: params.date ?? getTodayDateString(),
        createdAt: new Date().toISOString(),
      };
      const next = [tx, ...transactions];
      setTransactions(next);
      await setCachedJson(txKey, next);
      await supabase.from('finance_transactions').insert({
        id: tx.id,
        user_id: user.id,
        account_id: tx.accountId,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        note: tx.note,
        person: tx.person ?? null,
        payment_mode: tx.paymentMode,
        log_date: tx.date,
        created_at: tx.createdAt,
      });
      return tx;
    },
    [accounts, transactions, txKey, user.id]
  );

  const addSplitTransaction = useCallback(
    async (params: {
      accountId?: string;
      totalAmount: number;
      category: string;
      note?: string;
      people: string[];
      includeSelf: boolean;
      paymentMode: PaymentMode;
      date: string;
    }) => {
      const uniquePeople = Array.from(
        new Set(params.people.map((p) => p.trim()).filter(Boolean))
      );
      const ways = uniquePeople.length + (params.includeSelf ? 1 : 0);
      if (ways === 0) return;

      const accId = params.accountId ?? accounts[0]?.id ?? 'acc_sbi';
      const share = Math.round((params.totalAmount / ways) * 100) / 100;
      const baseNote = params.note?.trim()
        ? `${params.note.trim()} (Split ${ways} ways)`
        : `Split ${ways} ways`;
      const nowIso = new Date().toISOString();
      const created: FinanceTx[] = [];

      if (params.includeSelf) {
        created.push({
          id: `tx_${Date.now()}_self_${Math.random().toString(36).slice(2, 5)}`,
          accountId: accId,
          type: 'expense',
          amount: share,
          category: params.category,
          note: baseNote,
          paymentMode: params.paymentMode,
          date: params.date,
          createdAt: nowIso,
        });
      }

      uniquePeople.forEach((person, idx) => {
        created.push({
          id: `tx_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
          accountId: accId,
          type: 'lent',
          amount: share,
          category: params.category,
          note: baseNote,
          person,
          paymentMode: params.paymentMode,
          date: params.date,
          createdAt: nowIso,
        });
      });

      const next = [...created, ...transactions];
      setTransactions(next);
      await setCachedJson(txKey, next);
      await supabase.from('finance_transactions').insert(
        created.map((tx) => ({
          id: tx.id,
          user_id: user.id,
          account_id: tx.accountId,
          type: tx.type,
          amount: tx.amount,
          category: tx.category,
          note: tx.note,
          person: tx.person ?? null,
          payment_mode: tx.paymentMode,
          log_date: tx.date,
          created_at: tx.createdAt,
        }))
      );
    },
    [accounts, transactions, txKey, user.id]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      const next = transactions.filter((t) => t.id !== id);
      setTransactions(next);
      await setCachedJson(txKey, next);
      await supabase.from('finance_transactions').delete().eq('id', id);
    },
    [transactions, txKey]
  );

  const updateBudget = useCallback(
    async (amount: number) => {
      const valid = Math.max(0, Math.round(amount));
      setMonthlyBudget(valid);
      await setCachedJson(budgetKey, valid);
      await supabase.from('finance_budgets').upsert(
        {
          user_id: user.id,
          monthly_budget: valid,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    },
    [budgetKey, user.id]
  );

  /**
   * Computes expected balance for an account on `targetDate` by carrying forward
   * from `account.openingDate` through all transactions on days > openingDate and <= targetDate.
   */
  const getAccountBalanceAsOf = useCallback(
    (account: FinanceAccount, targetDate: string): number | null => {
      if (targetDate < account.openingDate) {
        return null;
      }
      let bal = account.openingBalance;
      for (const tx of transactions) {
        if (tx.accountId !== account.id) continue;
        if (tx.date > account.openingDate && tx.date <= targetDate) {
          if (tx.type === 'expense' || tx.type === 'lent') bal -= tx.amount;
          else bal += tx.amount;
        }
      }
      return Math.round(bal * 100) / 100;
    },
    [transactions]
  );

  const getPeriodReport = useCallback(
    (startDate: string, endDate: string) => {
      const periodTx = transactions.filter(
        (t) => t.date >= startDate && t.date <= endDate
      );
      let totalSpent = 0;
      let totalIncome = 0;
      let totalLent = 0;
      let totalReceived = 0;

      const categoryTotals: Record<string, number> = {};
      const modeTotals: Record<PaymentMode, number> = { UPI: 0, Cash: 0, Card: 0 };

      for (const t of periodTx) {
        if (t.type === 'expense') {
          totalSpent += t.amount;
          categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + t.amount;
          modeTotals[t.paymentMode] = (modeTotals[t.paymentMode] ?? 0) + t.amount;
        } else if (t.type === 'income') {
          totalIncome += t.amount;
        } else if (t.type === 'lent') {
          totalLent += t.amount;
          modeTotals[t.paymentMode] = (modeTotals[t.paymentMode] ?? 0) + t.amount;
        } else if (t.type === 'received') {
          totalReceived += t.amount;
        }
      }

      const categoryBreakdown = Object.entries(categoryTotals)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      const sortedTx = [...periodTx].sort((a, b) => b.date.localeCompare(a.date));

      return {
        transactions: sortedTx,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalLent: Math.round(totalLent * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        categoryBreakdown,
        modeTotals,
      };
    },
    [transactions]
  );

  const currentMonth = getTodayDateString().slice(0, 7);

  const monthStats = useMemo(() => {
    const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth));
    let totalSpent = 0;
    let totalIncome = 0;
    let totalLent = 0;
    let totalReceived = 0;

    const categoryTotals: Record<string, number> = {};
    const modeTotals: Record<PaymentMode, number> = { UPI: 0, Cash: 0, Card: 0 };

    for (const t of monthTx) {
      if (t.type === 'expense') {
        totalSpent += t.amount;
        categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + t.amount;
        modeTotals[t.paymentMode] = (modeTotals[t.paymentMode] ?? 0) + t.amount;
      } else if (t.type === 'income') {
        totalIncome += t.amount;
      } else if (t.type === 'lent') {
        totalLent += t.amount;
        modeTotals[t.paymentMode] = (modeTotals[t.paymentMode] ?? 0) + t.amount;
      } else if (t.type === 'received') {
        totalReceived += t.amount;
      }
    }

    const budgetUsedPct =
      monthlyBudget > 0 ? Math.min(100, Math.round((totalSpent / monthlyBudget) * 100)) : 0;

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalSpent,
      totalIncome,
      totalLent,
      totalReceived,
      budgetUsedPct,
      categoryBreakdown,
      modeTotals,
    };
  }, [currentMonth, monthlyBudget, transactions]);

  const peopleBalances = useMemo<PersonBalance[]>(() => {
    const map = new Map<string, { display: string; lent: number; received: number }>();
    for (const t of transactions) {
      if ((t.type !== 'lent' && t.type !== 'received') || !t.person) continue;
      const key = t.person.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { display: t.person, lent: 0, received: 0 });
      }
      const entry = map.get(key)!;
      if (t.type === 'lent') entry.lent += t.amount;
      else entry.received += t.amount;
    }

    return Array.from(map.values())
      .map((e) => ({
        person: e.display,
        lent: e.lent,
        received: e.received,
        net: Math.round((e.lent - e.received) * 100) / 100,
      }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [transactions]);

  const knownPeople = useMemo(
    () => peopleBalances.map((p) => p.person),
    [peopleBalances]
  );

  return {
    accounts,
    transactions,
    monthlyBudget,
    monthStats,
    peopleBalances,
    knownPeople,
    loading,
    addAccount,
    updateAccountBalance,
    getAccountBalanceAsOf,
    getPeriodReport,
    addTransaction,
    addSplitTransaction,
    deleteTransaction,
    updateBudget,
  };
}
