import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addDays } from '../context/DateContext';
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
  openingDate: string; // YYYY-MM-DD (balance at the BEGINNING of this date)
}

export interface FinanceTx {
  id: string;
  accountId: string; // account id, or 'external' when paid from prior advance/person
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
  net: number; // > 0 means they owe you / hold your money
}

const DEFAULT_ACCOUNTS: FinanceAccount[] = [
  {
    id: 'acc_sbi',
    name: 'SBI',
    openingBalance: 2300.67,
    openingDate: '2026-11-27',
  },
];

export function useFinance() {
  const { user } = useAuth();
  const txKey = `gym_finance_tx_${user.id}_v1`;
  const accKey = `gym_finance_accounts_${user.id}_v1`;

  const [accounts, setAccounts] = useState<FinanceAccount[]>(DEFAULT_ACCOUNTS);
  const [transactions, setTransactions] = useState<FinanceTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [cachedTx, cachedAcc] = await Promise.all([
        getCachedJson<FinanceTx[]>(txKey),
        getCachedJson<FinanceAccount[]>(accKey),
      ]);
      if (!cancelled) {
        if (cachedTx) setTransactions(cachedTx);
        if (cachedAcc && cachedAcc.length > 0) setAccounts(cachedAcc);
      }

      try {
        const [{ data: accRows }, { data: txRows }] = await Promise.all([
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
        }

        if (!cancelled && txRows) {
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
  }, [accKey, txKey, user.id]);

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
    async (accountId: string, newOpeningBalance: number, asOfDate: string) => {
      const rounded = Math.round(newOpeningBalance * 100) / 100;
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
      paidByPerson?: string; // If a friend paid from advance they held from you
      paymentMode: PaymentMode;
      date: string;
    }) => {
      const uniquePeople = Array.from(
        new Set(params.people.map((p) => p.trim()).filter(Boolean))
      );
      const ways = uniquePeople.length + (params.includeSelf ? 1 : 0);
      if (ways === 0) return;

      const share = Math.round((params.totalAmount / ways) * 100) / 100;
      const baseNote = params.note?.trim()
        ? `${params.note.trim()} (Split ${ways} ways)`
        : `Split ${ways} ways`;
      const nowIso = new Date().toISOString();
      const created: FinanceTx[] = [];

      if (params.paidByPerson) {
        // Paid by friend's advance: your share is an expense that reduces their balance (doesn't touch your bank)
        if (params.includeSelf) {
          created.push({
            id: `tx_${Date.now()}_adv_${Math.random().toString(36).slice(2, 5)}`,
            accountId: 'external',
            type: 'expense',
            amount: share,
            category: params.category,
            note: `${baseNote} • Paid by ${params.paidByPerson}`,
            person: params.paidByPerson,
            paymentMode: params.paymentMode,
            date: params.date,
            createdAt: nowIso,
          });
        }
      } else {
        const accId = params.accountId ?? accounts[0]?.id ?? 'acc_sbi';
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
      }

      if (created.length === 0) return;
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

  /**
   * Computes account balance at the END of `targetDate` (inclusive), starting from
   * `account.openingBalance` at the BEGINNING of `account.openingDate`.
   * Returns null for dates strictly before `account.openingDate`.
   */
  const getAccountBalanceAsOf = useCallback(
    (account: FinanceAccount, targetDate: string): number | null => {
      if (targetDate < account.openingDate) {
        return null;
      }
      let bal = account.openingBalance;
      for (const tx of transactions) {
        if (tx.accountId !== account.id) continue;
        if (tx.date >= account.openingDate && tx.date <= targetDate) {
          if (tx.type === 'expense' || tx.type === 'lent') bal -= tx.amount;
          else bal += tx.amount;
        }
      }
      return Math.round(bal * 100) / 100;
    },
    [transactions]
  );

  /**
   * Computes account balance at the BEGINNING of `targetDate` (i.e. previous day's closing balance).
   */
  const getAccountStartOfDay = useCallback(
    (account: FinanceAccount, targetDate: string): number | null => {
      if (targetDate < account.openingDate) return null;
      if (targetDate === account.openingDate) return account.openingBalance;
      return getAccountBalanceAsOf(account, addDays(targetDate, -1));
    },
    [getAccountBalanceAsOf]
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
          if (t.accountId !== 'external') {
            modeTotals[t.paymentMode] = (modeTotals[t.paymentMode] ?? 0) + t.amount;
          }
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

  const peopleBalances = useMemo<PersonBalance[]>(() => {
    const map = new Map<string, { display: string; lent: number; received: number }>();
    for (const t of transactions) {
      if (!t.person) continue;
      const key = t.person.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { display: t.person, lent: 0, received: 0 });
      }
      const entry = map.get(key)!;
      if (t.type === 'lent') {
        entry.lent += t.amount;
      } else if (t.type === 'received') {
        entry.received += t.amount;
      } else if (t.type === 'expense' && t.accountId === 'external') {
        // Paid by friend from the advance they held from you -> reduces what they owe you
        entry.received += t.amount;
      }
    }

    return Array.from(map.values())
      .map((e) => ({
        person: e.display,
        lent: Math.round(e.lent * 100) / 100,
        received: Math.round(e.received * 100) / 100,
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
    peopleBalances,
    knownPeople,
    loading,
    addAccount,
    updateAccountBalance,
    getAccountBalanceAsOf,
    getAccountStartOfDay,
    getPeriodReport,
    addTransaction,
    addSplitTransaction,
    deleteTransaction,
  };
}
