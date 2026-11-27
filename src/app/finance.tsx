import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  PieChart,
  Plus,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { DateStrip } from '../components/DateStrip';
import { addDays, formatReadableDate, useSelectedDate } from '../context/DateContext';
import {
  EXPENSE_CATEGORIES,
  PaymentMode,
  TxType,
  useFinance,
} from '../hooks/useFinance';
import { getWeekKey } from '../hooks/useDiet';
import { getTodayDateString } from '../lib/storage';
import { Colors } from '../theme/colors';

type QuickMode = TxType | 'split';
type ReportPeriod = 'daily' | 'weekly' | 'monthly';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];
const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Card'];
const TX_TYPES: { key: QuickMode; label: string }[] = [
  { key: 'expense', label: 'Spent' },
  { key: 'split', label: 'Split' },
  { key: 'income', label: 'Income' },
  { key: 'lent', label: 'Gave' },
  { key: 'received', label: 'Got Back' },
];

const PIE_COLORS = [
  '#1F4D3D',
  '#B4693E',
  '#2E6F56',
  '#6D5D7E',
  '#3B6E8C',
  '#9C7A3C',
  '#B84343',
  '#5C7A52',
];

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

function getMonthRange(todayStr: string, monthOffset: number) {
  const [y, m] = todayStr.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1 + monthOffset, 1);
  const yy = dt.getFullYear();
  const mm = dt.getMonth() + 1;
  const lastDay = new Date(yy, mm, 0).getDate();
  const mmStr = String(mm).padStart(2, '0');
  return {
    startDate: `${yy}-${mmStr}-01`,
    endDate: `${yy}-${mmStr}-${String(lastDay).padStart(2, '0')}`,
    label: dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}

export default function FinanceScreen() {
  const { selectedDate } = useSelectedDate();
  const todayStr = getTodayDateString();
  const {
    accounts,
    peopleBalances,
    knownPeople,
    addAccount,
    updateAccountBalance,
    getAccountBalanceAsOf,
    getPeriodReport,
    addTransaction,
    addSplitTransaction,
    deleteTransaction,
  } = useFinance();

  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [subTab, setSubTab] = useState<'ledger' | 'people' | 'stats'>('ledger');

  // Quick-Add state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? 'acc_sbi');
  const [txType, setTxType] = useState<QuickMode>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [noteInput, setNoteInput] = useState('');
  const [personInput, setPersonInput] = useState('');
  const [splitPeople, setSplitPeople] = useState<string[]>([]);
  const [splitIncludeSelf, setSplitIncludeSelf] = useState(true);
  const [splitNewPerson, setSplitNewPerson] = useState('');

  // Account modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [editingAccId, setEditingAccId] = useState<string | null>(null);

  const activeAccountId = accounts.some((a) => a.id === selectedAccountId)
    ? selectedAccountId
    : (accounts[0]?.id ?? 'acc_sbi');

  const accountBalancesForDate = accounts.map((acc) => getAccountBalanceAsOf(acc, selectedDate));
  const hasAnyBalanceData = accountBalancesForDate.some((b) => b !== null);
  const totalLeftAsOfDate = hasAnyBalanceData
    ? accountBalancesForDate.reduce<number>((sum, b) => sum + (b ?? 0), 0)
    : null;

  const weekRange = useMemo(() => {
    const start = addDays(getWeekKey(todayStr), weekOffset * 7);
    return { startDate: start, endDate: addDays(start, 6) };
  }, [todayStr, weekOffset]);

  const monthRange = useMemo(
    () => getMonthRange(todayStr, monthOffset),
    [monthOffset, todayStr]
  );

  const activeRange =
    reportPeriod === 'daily'
      ? { startDate: selectedDate, endDate: selectedDate }
      : reportPeriod === 'weekly'
        ? weekRange
        : { startDate: monthRange.startDate, endDate: monthRange.endDate };

  const periodReport = useMemo(
    () => getPeriodReport(activeRange.startDate, activeRange.endDate),
    [activeRange.endDate, activeRange.startDate, getPeriodReport]
  );

  const bumpAmount = (delta: number) => {
    const cur = parseFloat(amountInput) || 0;
    setAmountInput(String(cur + delta));
  };

  const toggleSplitPerson = (name: string) => {
    setSplitPeople((prev) =>
      prev.some((p) => p.toLowerCase() === name.toLowerCase())
        ? prev.filter((p) => p.toLowerCase() !== name.toLowerCase())
        : [...prev, name]
    );
  };

  const handleQuickAdd = async () => {
    const amt = parseFloat(amountInput);
    if (Number.isNaN(amt) || amt <= 0) {
      Alert.alert('Enter Amount', 'Tap a quick amount chip or enter ₹ amount.');
      return;
    }

    if (txType === 'split') {
      const pendingNew = splitNewPerson.trim();
      const allPeople = pendingNew ? [...splitPeople, pendingNew] : splitPeople;
      if (allPeople.length === 0) {
        Alert.alert('Select People', 'Add or select at least 1 person to split with.');
        return;
      }
      await addSplitTransaction({
        accountId: activeAccountId,
        totalAmount: amt,
        category,
        note: noteInput,
        people: allPeople,
        includeSelf: splitIncludeSelf,
        paymentMode,
        date: selectedDate,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAmountInput('');
      setNoteInput('');
      setSplitNewPerson('');
      setSplitPeople([]);
      return;
    }

    if ((txType === 'lent' || txType === 'received') && !personInput.trim()) {
      Alert.alert('Person Name', 'Tap or type who you gave/got money from.');
      return;
    }

    await addTransaction({
      accountId: activeAccountId,
      type: txType,
      amount: amt,
      category: txType === 'expense' ? category : txType === 'income' ? 'Income' : 'Udhar',
      note: noteInput,
      person: txType === 'lent' || txType === 'received' ? personInput : undefined,
      paymentMode,
      date: selectedDate,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAmountInput('');
    setNoteInput('');
  };

  const handleSettlePerson = async (person: string, net: number) => {
    await addTransaction({
      accountId: activeAccountId,
      type: net > 0 ? 'received' : 'lent',
      amount: Math.abs(net),
      category: 'Settlement',
      note: 'Settled',
      person,
      paymentMode: 'UPI',
      date: selectedDate,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Pie Chart for active period
  const totalCatSpend = Math.max(
    1,
    periodReport.categoryBreakdown.reduce((s, c) => s + c.amount, 0)
  );
  const pieRadius = 36;
  const pieCirc = 2 * Math.PI * pieRadius;
  const pieSegments = periodReport.categoryBreakdown.reduce<
    { category: string; amount: number; pct: number; dash: number; offset: number; color: string }[]
  >((acc, item, idx) => {
    const prevSum = acc.reduce((s, x) => s + x.dash, 0);
    const pct = Math.round((item.amount / totalCatSpend) * 100);
    const dash = (item.amount / totalCatSpend) * pieCirc;
    acc.push({
      category: item.category,
      amount: item.amount,
      pct,
      dash,
      offset: -prevSum,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    });
    return acc;
  }, []);

  const periodTitle =
    reportPeriod === 'daily'
      ? `${formatReadableDate(selectedDate)} (${selectedDate})`
      : reportPeriod === 'weekly'
        ? `${formatShortDate(weekRange.startDate)} – ${formatShortDate(weekRange.endDate)}`
        : monthRange.label;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Period Switcher: Daily | Weekly | Monthly */}
      <View style={styles.periodBar}>
        {(['daily', 'weekly', 'monthly'] as ReportPeriod[]).map((p) => {
          const active = reportPeriod === p;
          return (
            <Pressable
              key={p}
              style={[styles.periodPill, active && styles.periodPillActive]}
              onPress={() => setReportPeriod(p)}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {reportPeriod === 'daily' && <DateStrip />}

      {reportPeriod === 'weekly' && (
        <View style={styles.navBar}>
          <Pressable style={styles.navArrow} onPress={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft size={18} color={Colors.text} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.rowGapSmall}>
              <Calendar size={14} color={Colors.primary} />
              <Text style={styles.navTitle}>
                {formatShortDate(weekRange.startDate)} – {formatShortDate(weekRange.endDate)}
              </Text>
            </View>
            <Text style={styles.navSub}>
              {weekOffset === 0 ? 'This Week' : `${Math.abs(weekOffset)} wk ago`}
            </Text>
          </View>
          <View style={styles.rowGapSmall}>
            {weekOffset !== 0 && (
              <Pressable style={styles.nowChip} onPress={() => setWeekOffset(0)}>
                <Text style={styles.nowChipText}>Now</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.navArrow, weekOffset >= 0 && { opacity: 0.35 }]}
              disabled={weekOffset >= 0}
              onPress={() => setWeekOffset((w) => Math.min(0, w + 1))}
            >
              <ChevronRight size={18} color={Colors.text} />
            </Pressable>
          </View>
        </View>
      )}

      {reportPeriod === 'monthly' && (
        <View style={styles.navBar}>
          <Pressable style={styles.navArrow} onPress={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft size={18} color={Colors.text} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.rowGapSmall}>
              <Calendar size={14} color={Colors.primary} />
              <Text style={styles.navTitle}>{monthRange.label}</Text>
            </View>
            <Text style={styles.navSub}>
              {monthOffset === 0 ? 'Current Month' : `${Math.abs(monthOffset)} mo ago`}
            </Text>
          </View>
          <View style={styles.rowGapSmall}>
            {monthOffset !== 0 && (
              <Pressable style={styles.nowChip} onPress={() => setMonthOffset(0)}>
                <Text style={styles.nowChipText}>Now</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.navArrow, monthOffset >= 0 && { opacity: 0.35 }]}
              disabled={monthOffset >= 0}
              onPress={() => setMonthOffset((m) => Math.min(0, m + 1))}
            >
              <ChevronRight size={18} color={Colors.text} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Hero Balance & Period Report Card */}
      <View style={styles.heroCard}>
        <View>
          <Text style={styles.kicker}>
            AS OF {formatReadableDate(selectedDate).toUpperCase()} • TOTAL LEFT
          </Text>
          <Text
            style={[
              styles.heroAmount,
              totalLeftAsOfDate !== null && totalLeftAsOfDate < 0 && { color: Colors.danger },
            ]}
          >
            {totalLeftAsOfDate !== null
              ? `₹${totalLeftAsOfDate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
              : 'No data'}
          </Text>
        </View>

        {/* Accounts Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {accounts.map((acc) => {
            const bal = getAccountBalanceAsOf(acc, selectedDate);
            return (
              <Pressable
                key={acc.id}
                style={styles.accountTile}
                onPress={() => {
                  setEditingAccId(acc.id);
                  setNewAccName(acc.name);
                  setNewAccBalance(bal !== null ? String(bal) : '');
                  setAccountModalOpen(true);
                }}
              >
                <Text style={styles.accountName}>{acc.name}</Text>
                <Text style={styles.accountBal}>
                  {bal !== null
                    ? `₹${bal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                    : '—'}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={styles.addAccountTile}
            onPress={() => {
              setEditingAccId(null);
              setNewAccName('');
              setNewAccBalance('');
              setAccountModalOpen(true);
            }}
          >
            <Plus size={15} color={Colors.primary} />
            <Text style={styles.addAccountText}>Add Account</Text>
          </Pressable>
        </ScrollView>

        {/* Period Totals (Daily / Weekly / Monthly) */}
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLbl}>Spent ({reportPeriod})</Text>
            <Text style={[styles.heroStatVal, { color: Colors.danger }]}>
              ₹{periodReport.totalSpent.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLbl}>Gave / Dues</Text>
            <Text style={[styles.heroStatVal, { color: Colors.amber }]}>
              ₹{periodReport.totalLent.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLbl}>Got Back / In</Text>
            <Text style={[styles.heroStatVal, { color: Colors.success }]}>
              ₹{(periodReport.totalIncome + periodReport.totalReceived).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </View>

      {/* Sub-Tabs */}
      <View style={styles.subTabBar}>
        <Pressable
          style={[styles.subTab, subTab === 'ledger' && styles.subTabActive]}
          onPress={() => setSubTab('ledger')}
        >
          <Wallet size={14} color={subTab === 'ledger' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.subTabText, subTab === 'ledger' && styles.subTabTextActive]}>
            {reportPeriod === 'daily' ? 'Quick Add' : 'Report'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subTab, subTab === 'people' && styles.subTabActive]}
          onPress={() => setSubTab('people')}
        >
          <Users size={14} color={subTab === 'people' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.subTabText, subTab === 'people' && styles.subTabTextActive]}>
            People ({peopleBalances.filter((p) => p.net !== 0).length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subTab, subTab === 'stats' && styles.subTabActive]}
          onPress={() => setSubTab('stats')}
        >
          <PieChart size={14} color={subTab === 'stats' ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.subTabText, subTab === 'stats' && styles.subTabTextActive]}>
            Breakdown
          </Text>
        </Pressable>
      </View>

      {/* TAB 1: QUICK ADD (in Daily) + PERIOD TRANSACTIONS REPORT */}
      {subTab === 'ledger' && (
        <>
          {reportPeriod === 'daily' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>3-Second Entry</Text>

              <View style={styles.rowGapSmall}>
                {TX_TYPES.map((t) => {
                  const active = txType === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      style={[styles.typePill, active && styles.typePillActive]}
                      onPress={() => setTxType(t.key)}
                    >
                      <Text style={[styles.typeText, active && styles.typeTextActive]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.rupeePrefix}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  value={amountInput}
                  onChangeText={setAmountInput}
                />
                {Boolean(amountInput) && (
                  <Pressable onPress={() => setAmountInput('')}>
                    <X size={18} color={Colors.textMuted} />
                  </Pressable>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {QUICK_AMOUNTS.map((amt) => (
                  <Pressable key={amt} style={styles.quickChip} onPress={() => bumpAmount(amt)}>
                    <Text style={styles.quickChipText}>+₹{amt}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {(txType === 'expense' || txType === 'split') && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const active = category === cat;
                    return (
                      <Pressable
                        key={cat}
                        style={[styles.catChip, active && styles.catChipActive]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text style={[styles.catText, active && styles.catTextActive]}>{cat}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {txType === 'split' && (
                <View style={styles.splitBox}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.splitLabel}>Split with people:</Text>
                    <Pressable
                      style={[styles.includeMeChip, splitIncludeSelf && styles.includeMeActive]}
                      onPress={() => setSplitIncludeSelf((v) => !v)}
                    >
                      <Text
                        style={[
                          styles.includeMeText,
                          splitIncludeSelf && { color: Colors.primary },
                        ]}
                      >
                        {splitIncludeSelf ? '✓ Include me' : 'Exclude me'}
                      </Text>
                    </Pressable>
                  </View>

                  {knownPeople.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {knownPeople.map((person) => {
                        const active = splitPeople.some(
                          (p) => p.toLowerCase() === person.toLowerCase()
                        );
                        return (
                          <Pressable
                            key={person}
                            style={[styles.catChip, active && styles.catChipActive]}
                            onPress={() => toggleSplitPerson(person)}
                          >
                            <Text style={[styles.catText, active && styles.catTextActive]}>
                              {active ? `✓ ${person}` : person}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}

                  <View style={styles.rowGap}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Add person (e.g. Aman)"
                      placeholderTextColor={Colors.textMuted}
                      value={splitNewPerson}
                      onChangeText={setSplitNewPerson}
                    />
                    <Pressable
                      style={styles.addPersonBtn}
                      onPress={() => {
                        if (!splitNewPerson.trim()) return;
                        toggleSplitPerson(splitNewPerson.trim());
                        setSplitNewPerson('');
                      }}
                    >
                      <Plus size={16} color={Colors.primaryText} />
                    </Pressable>
                  </View>

                  {splitPeople.length > 0 && (parseFloat(amountInput) || 0) > 0 && (
                    <Text style={styles.splitPreview}>
                      Split {splitPeople.length + (splitIncludeSelf ? 1 : 0)} ways → ₹
                      {(
                        (parseFloat(amountInput) || 0) /
                        (splitPeople.length + (splitIncludeSelf ? 1 : 0))
                      ).toFixed(0)}{' '}
                      each
                    </Text>
                  )}
                </View>
              )}

              {(txType === 'lent' || txType === 'received') && (
                <View style={{ gap: 8 }}>
                  {knownPeople.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {knownPeople.map((person) => {
                        const active = personInput.toLowerCase() === person.toLowerCase();
                        return (
                          <Pressable
                            key={person}
                            style={[styles.catChip, active && styles.catChipActive]}
                            onPress={() => setPersonInput(person)}
                          >
                            <Text style={[styles.catText, active && styles.catTextActive]}>
                              {person}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                  <TextInput
                    style={styles.input}
                    placeholder="Person name (e.g. Rahul)"
                    placeholderTextColor={Colors.textMuted}
                    value={personInput}
                    onChangeText={setPersonInput}
                  />
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {accounts.map((acc) => {
                  const active = acc.id === activeAccountId;
                  return (
                    <Pressable
                      key={acc.id}
                      style={[styles.catChip, active && styles.catChipActive]}
                      onPress={() => setSelectedAccountId(acc.id)}
                    >
                      <Text style={[styles.catText, active && styles.catTextActive]}>{acc.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.rowGap}>
                <View style={styles.modeGroup}>
                  {PAYMENT_MODES.map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.modePill, paymentMode === m && styles.modePillActive]}
                      onPress={() => setPaymentMode(m)}
                    >
                      <Text style={[styles.modeText, paymentMode === m && styles.modeTextActive]}>
                        {m}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Where / note (optional)"
                  placeholderTextColor={Colors.textMuted}
                  value={noteInput}
                  onChangeText={setNoteInput}
                />
              </View>

              <Pressable style={styles.addBtn} onPress={() => void handleQuickAdd()}>
                <Plus size={18} color={Colors.primaryText} />
                <Text style={styles.addBtnText}>
                  Add {amountInput ? `₹${amountInput}` : 'Entry'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Category Summary for Weekly & Monthly Reports */}
          {reportPeriod !== 'daily' && periodReport.categoryBreakdown.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Expenses by Category ({periodTitle})
              </Text>
              {periodReport.categoryBreakdown.map((item) => (
                <View key={item.category} style={styles.catReportRow}>
                  <Text style={styles.catReportName}>{item.category}</Text>
                  <Text style={styles.catReportAmt}>
                    ₹{item.amount.toLocaleString('en-IN')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Transactions List for Selected Period (Daily / Weekly / Monthly) */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{periodTitle}</Text>
              <Text style={styles.txMeta}>{periodReport.transactions.length} entries</Text>
            </View>

            {periodReport.transactions.length === 0 ? (
              <Text style={styles.emptyText}>No transactions recorded for {periodTitle}.</Text>
            ) : (
              periodReport.transactions.map((tx) => {
                const isOut = tx.type === 'expense' || tx.type === 'lent';
                return (
                  <View key={tx.id} style={styles.txRow}>
                    <View
                      style={[
                        styles.txIcon,
                        {
                          backgroundColor: isOut ? Colors.dangerSoft : Colors.successSoft,
                        },
                      ]}
                    >
                      {isOut ? (
                        <ArrowUpRight size={15} color={Colors.danger} />
                      ) : (
                        <ArrowDownLeft size={15} color={Colors.success} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle}>
                        {tx.person
                          ? `${tx.person} (${tx.type === 'lent' ? 'Gave' : 'Got'})`
                          : tx.category}
                        {tx.note ? ` • ${tx.note}` : ''}
                      </Text>
                      <Text style={styles.txMeta}>
                        {tx.date} • {accounts.find((a) => a.id === tx.accountId)?.name ?? 'SBI'} •{' '}
                        {tx.paymentMode}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.txAmt,
                        { color: isOut ? Colors.danger : Colors.success },
                      ]}
                    >
                      {isOut ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                    </Text>
                    <Pressable onPress={() => void deleteTransaction(tx.id)}>
                      <Trash2 size={15} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      {/* TAB 2: PEOPLE / UDHAR */}
      {subTab === 'people' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Money Given &amp; Received (Dues)</Text>
          {peopleBalances.length === 0 ? (
            <Text style={styles.emptyText}>
              Use &quot;Gave&quot;, &quot;Got Back&quot;, or &quot;Split&quot; to track dues with friends.
            </Text>
          ) : (
            peopleBalances.map((p) => (
              <View key={p.person} style={styles.personRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>{p.person}</Text>
                  <Text style={styles.txMeta}>
                    Gave ₹{p.lent} • Got ₹{p.received}
                  </Text>
                </View>
                {p.net === 0 ? (
                  <Text style={[styles.settledText, { color: Colors.success }]}>Settled ✓</Text>
                ) : (
                  <View style={styles.rowGapSmall}>
                    <Text
                      style={[
                        styles.txAmt,
                        { color: p.net > 0 ? Colors.success : Colors.danger },
                      ]}
                    >
                      {p.net > 0 ? `Gets ₹${p.net}` : `Owe ₹${Math.abs(p.net)}`}
                    </Text>
                    <Pressable
                      style={styles.settleBtn}
                      onPress={() => void handleSettlePerson(p.person, p.net)}
                    >
                      <Check size={13} color={Colors.primaryText} />
                      <Text style={styles.settleBtnText}>Settle</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {/* TAB 3: BREAKDOWN CHARTS */}
      {subTab === 'stats' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending Breakdown ({periodTitle})</Text>
          {periodReport.categoryBreakdown.length === 0 ? (
            <Text style={styles.emptyText}>No expenses recorded in this period.</Text>
          ) : (
            <View style={styles.pieRow}>
              <Svg width={96} height={96}>
                <G rotation="-90" origin="48, 48">
                  {pieSegments.map((seg) => (
                    <Circle
                      key={seg.category}
                      cx={48}
                      cy={48}
                      r={pieRadius}
                      stroke={seg.color}
                      strokeWidth={16}
                      strokeDasharray={`${seg.dash} ${pieCirc}`}
                      strokeDashoffset={seg.offset}
                      fill="none"
                    />
                  ))}
                </G>
              </Svg>
              <View style={{ flex: 1, gap: 5 }}>
                {pieSegments.map((seg) => (
                  <View key={seg.category} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                    <Text style={styles.legendLabel}>{seg.category}</Text>
                    <Text style={styles.legendPct}>
                      ₹{seg.amount} ({seg.pct}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.modeStatsRow}>
            {PAYMENT_MODES.map((m) => (
              <View key={m} style={styles.modeStatBox}>
                <Text style={styles.heroStatLbl}>{m}</Text>
                <Text style={styles.heroStatVal}>
                  ₹{periodReport.modeTotals[m].toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Add / Edit Account Modal */}
      <Modal visible={accountModalOpen} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>
                {editingAccId ? `Update ${newAccName} Balance` : 'Add Bank / Cash Account'}
              </Text>
              <Pressable onPress={() => setAccountModalOpen(false)}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            {!editingAccId && (
              <TextInput
                style={styles.input}
                value={newAccName}
                onChangeText={setNewAccName}
                placeholder="Account name (e.g. HDFC, Cash)"
                placeholderTextColor={Colors.textMuted}
              />
            )}
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={newAccBalance}
              onChangeText={setNewAccBalance}
              placeholder={`Balance left on ${selectedDate} (₹)`}
              placeholderTextColor={Colors.textMuted}
            />
            <Pressable
              style={styles.addBtn}
              onPress={async () => {
                const bal = parseFloat(newAccBalance) || 0;
                if (editingAccId) {
                  await updateAccountBalance(editingAccId, bal, selectedDate);
                } else {
                  if (!newAccName.trim()) return;
                  const created = await addAccount(newAccName, bal, selectedDate);
                  setSelectedAccountId(created.id);
                }
                setAccountModalOpen(false);
              }}
            >
              <Text style={styles.addBtnText}>
                {editingAccId ? 'Update Balance' : 'Create Account'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  periodBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodPillActive: { backgroundColor: Colors.primary },
  periodText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  periodTextActive: { color: Colors.primaryText },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navArrow: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  navSub: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  nowChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  nowChipText: { color: Colors.gold, fontSize: 11, fontWeight: '700' },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowGapSmall: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  kicker: { color: Colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  heroAmount: { color: Colors.text, fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroStatsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 10,
  },
  heroStat: { flex: 1 },
  heroStatLbl: { color: Colors.textMuted, fontSize: 11 },
  heroStatVal: { color: Colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  accountTile: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 100,
  },
  accountName: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  accountBal: { color: Colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
  addAccountTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addAccountText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  subTabBar: { flexDirection: 'row', gap: 8 },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subTabActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  subTabText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  subTabTextActive: { color: Colors.primary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  typePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  typePillActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  typeText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  typeTextActive: { color: Colors.primary },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  rupeePrefix: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  amountInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    paddingVertical: 6,
  },
  quickChip: {
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickChipText: { color: Colors.gold, fontSize: 12, fontWeight: '800' },
  catChip: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  catChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  catText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  catTextActive: { color: Colors.primary, fontWeight: '700' },
  splitBox: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  splitLabel: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  includeMeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  includeMeActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  includeMeText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  addPersonBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitPreview: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  modeGroup: { flexDirection: 'row', gap: 4 },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modePillActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  modeText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  modeTextActive: { color: Colors.primary },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addBtnText: { color: Colors.primaryText, fontSize: 14, fontWeight: '800' },
  catReportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  catReportName: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  catReportAmt: { color: Colors.text, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  txIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  txMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    gap: 8,
  },
  settledText: { fontSize: 12, fontWeight: '700' },
  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  settleBtnText: { color: Colors.primaryText, fontSize: 11, fontWeight: '700' },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { color: Colors.text, fontSize: 12, flex: 1 },
  legendPct: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  modeStatsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 12,
  },
  modeStatBox: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
