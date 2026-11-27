import React, { useState } from 'react';
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
  Check,
  PieChart,
  Plus,
  Settings,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { DateStrip } from '../components/DateStrip';
import { formatReadableDate, useSelectedDate } from '../context/DateContext';
import {
  EXPENSE_CATEGORIES,
  PaymentMode,
  TxType,
  useFinance,
} from '../hooks/useFinance';
import { Colors } from '../theme/colors';

type QuickMode = TxType | 'split';

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
];

export default function FinanceScreen() {
  const { selectedDate } = useSelectedDate();
  const {
    accounts,
    transactions,
    monthlyBudget,
    monthStats,
    peopleBalances,
    knownPeople,
    addAccount,
    updateAccountBalance,
    getAccountBalanceAsOf,
    addTransaction,
    addSplitTransaction,
    deleteTransaction,
    updateBudget,
  } = useFinance();

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

  // Budget & Account modals
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(monthlyBudget));
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
      type: net > 0 ? 'received' : 'lent',
      amount: Math.abs(net),
      category: 'Settlement',
      note: 'Settled',
      person,
      paymentMode: 'UPI',
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Pie Chart data
  const totalCatSpend = Math.max(
    1,
    monthStats.categoryBreakdown.reduce((s, c) => s + c.amount, 0)
  );
  const pieRadius = 36;
  const pieCirc = 2 * Math.PI * pieRadius;
  const pieSegments = monthStats.categoryBreakdown.reduce<
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DateStrip />

      {/* Hero Balance Card */}
      <View style={styles.heroCard}>
        <View style={styles.rowBetween}>
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
          <Pressable
            style={styles.iconBtn}
            onPress={() => {
              setBudgetDraft(String(monthlyBudget));
              setBudgetModalOpen(true);
            }}
          >
            <Settings size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Accounts Strip (Auto-calculated carry-forward balances) */}
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

        <View style={styles.barBg}>
          <View
            style={[
              styles.barFill,
              {
                width: `${monthStats.budgetUsedPct}%`,
                backgroundColor:
                  monthStats.budgetUsedPct > 90 ? Colors.danger : Colors.primary,
              },
            ]}
          />
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLbl}>Spent</Text>
            <Text style={[styles.heroStatVal, { color: Colors.danger }]}>
              ₹{monthStats.totalSpent.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLbl}>Budget</Text>
            <Text style={styles.heroStatVal}>₹{monthlyBudget.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLbl}>Gave / Lent</Text>
            <Text style={[styles.heroStatVal, { color: Colors.amber }]}>
              ₹{monthStats.totalLent.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLbl}>Got Back</Text>
            <Text style={[styles.heroStatVal, { color: Colors.success }]}>
              ₹{(monthStats.totalIncome + monthStats.totalReceived).toLocaleString('en-IN')}
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
            Quick Add
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
            Stats
          </Text>
        </Pressable>
      </View>

      {/* TAB 1: QUICK ADD + RECENT LEDGER */}
      {subTab === 'ledger' && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3-Second Entry</Text>

            {/* Transaction Type */}
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

            {/* Amount + 1-Tap Chips */}
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

            {/* Category (for Expense or Split) */}
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

            {/* Split Between People */}
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

            {/* Account Selector */}
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

            {/* Payment Mode + Optional Where/Note */}
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

          {/* Selected Date Transactions */}
          {(() => {
            const dayTxs = transactions.filter((t) => t.date === selectedDate);
            const dayOut = dayTxs
              .filter((t) => t.type === 'expense' || t.type === 'lent')
              .reduce((s, t) => s + t.amount, 0);
            const dayIn = dayTxs
              .filter((t) => t.type === 'income' || t.type === 'received')
              .reduce((s, t) => s + t.amount, 0);

            return (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>
                    {formatReadableDate(selectedDate)} ({selectedDate})
                  </Text>
                  <View style={styles.rowGapSmall}>
                    {dayOut > 0 && (
                      <Text style={[styles.dayGroupTotal, { color: Colors.danger }]}>
                        -₹{dayOut.toLocaleString('en-IN')}
                      </Text>
                    )}
                    {dayIn > 0 && (
                      <Text style={[styles.dayGroupTotal, { color: Colors.success }]}>
                        +₹{dayIn.toLocaleString('en-IN')}
                      </Text>
                    )}
                  </View>
                </View>

                {dayTxs.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No transactions on {formatReadableDate(selectedDate)}. Use Quick Add above to
                    log for this date.
                  </Text>
                ) : (
                  dayTxs.map((tx) => {
                    const isOut = tx.type === 'expense' || tx.type === 'lent';
                    const timeLabel = new Date(tx.createdAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    });
                    return (
                      <View key={tx.id} style={styles.txRow}>
                        <View
                          style={[
                            styles.txIcon,
                            {
                              backgroundColor: isOut
                                ? Colors.dangerSoft
                                : Colors.successSoft,
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
                            {timeLabel} •{' '}
                            {accounts.find((a) => a.id === tx.accountId)?.name ?? 'SBI'} •{' '}
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
            );
          })()}
        </>
      )}

      {/* TAB 2: PEOPLE / UDHAR */}
      {subTab === 'people' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Money Given &amp; Received (People)</Text>
          {peopleBalances.length === 0 ? (
            <Text style={styles.emptyText}>
              Use &quot;Gave&quot; or &quot;Got Back&quot; in Quick Add to track money with friends.
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

      {/* TAB 3: STATS & CHARTS */}
      {subTab === 'stats' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending Breakdown (This Month)</Text>
          {monthStats.categoryBreakdown.length === 0 ? (
            <Text style={styles.emptyText}>Log expenses this month to see category charts.</Text>
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
                  ₹{monthStats.modeTotals[m].toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Budget Modal */}
      <Modal visible={budgetModalOpen} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Monthly Starting Budget (₹)</Text>
              <Pressable onPress={() => setBudgetModalOpen(false)}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={budgetDraft}
              onChangeText={setBudgetDraft}
              placeholder="15000"
              placeholderTextColor={Colors.textMuted}
            />
            <Pressable
              style={styles.addBtn}
              onPress={async () => {
                await updateBudget(parseInt(budgetDraft, 10) || 0);
                setBudgetModalOpen(false);
              }}
            >
              <Text style={styles.addBtnText}>Save Budget</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  barBg: { height: 7, borderRadius: 4, backgroundColor: Colors.surfaceElevated, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  heroStatsRow: { flexDirection: 'row', paddingTop: 4 },
  heroStat: { flex: 1 },
  heroStatLbl: { color: Colors.textMuted, fontSize: 11 },
  heroStatVal: { color: Colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
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
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  dayGroup: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    gap: 2,
  },
  dayGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  dayGroupTitle: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  dayGroupTotal: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
});
