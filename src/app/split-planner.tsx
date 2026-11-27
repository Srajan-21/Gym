import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Calendar, Plus, Trash2, X } from 'lucide-react-native';
import { addDays } from '../context/DateContext';
import { DAY_NAMES, FULL_DAY_NAMES, useSplit } from '../hooks/useSplit';
import { getTodayDateString } from '../lib/storage';
import { Colors } from '../theme/colors';
import { EquipmentType, MuscleGroup } from '../types/database';

const MUSCLES: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'cardio',
];

const EQUIPMENTS: EquipmentType[] = [
  'machine',
  'dumbbell',
  'barbell',
  'cable',
  'bodyweight',
  'other',
];

export default function SplitPlannerScreen() {
  const {
    exercises,
    splitsByDay,
    periodPlans,
    upsertDaySplit,
    addExerciseToDay,
    removeExerciseFromDay,
    createPeriodPlan,
    deletePeriodPlan,
    upsertPeriodDaySplit,
    addExerciseToPeriodDay,
    removeExerciseFromPeriodDay,
    createCustomExercise,
  } = useSplit();

  const today = getTodayDateString();
  const [plannerMode, setPlannerMode] = useState<'period' | 'weekly'>('period');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addDays(today, 29));

  const activePlan =
    periodPlans.find((p) => p.id === selectedPlanId) ?? periodPlans[0] ?? null;

  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const currentPeriodDay = activePlan?.days[selectedDay];
  const currentWeeklyDay = splitsByDay[selectedDay];

  const resolvedDayName =
    plannerMode === 'period'
      ? (currentPeriodDay?.splitName ?? '')
      : (currentWeeklyDay?.split.split_name ?? '');
  const resolvedIsRest =
    plannerMode === 'period'
      ? (currentPeriodDay?.isRestDay ?? false)
      : (currentWeeklyDay?.split.is_rest_day ?? false);
  const resolvedExercises =
    plannerMode === 'period'
      ? (currentPeriodDay?.exercises ?? [])
      : (currentWeeklyDay?.exercises ?? []);

  const [splitName, setSplitName] = useState(resolvedDayName);
  const [isRestDay, setIsRestDay] = useState(resolvedIsRest);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetSets, setTargetSets] = useState('3');
  const [targetRepRange, setTargetRepRange] = useState('8-12');

  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup>('chest');
  const [customEquipment, setCustomEquipment] = useState<EquipmentType>('machine');

  const syncDayFields = (mode: 'period' | 'weekly', dayIdx: number, plan = activePlan) => {
    if (mode === 'period') {
      const d = plan?.days[dayIdx];
      setSplitName(d?.splitName ?? '');
      setIsRestDay(d?.isRestDay ?? false);
    } else {
      const d = splitsByDay[dayIdx];
      setSplitName(d?.split.split_name ?? '');
      setIsRestDay(d?.split.is_rest_day ?? false);
    }
  };

  const handleSelectDay = (dayIdx: number) => {
    setSelectedDay(dayIdx);
    syncDayFields(plannerMode, dayIdx);
  };

  const handleCreatePeriod = async () => {
    try {
      const created = await createPeriodPlan(planName, fromDate, toDate);
      if (created) {
        setSelectedPlanId(created.id);
        setPlanName('');
        syncDayFields('period', selectedDay, created);
        Alert.alert('Period Plan Created', `${created.startDate} to ${created.endDate}`);
      }
    } catch (err) {
      Alert.alert('Invalid Dates', err instanceof Error ? err.message : 'Check dates.');
    }
  };

  const handleSaveDayHeader = async () => {
    try {
      const nameToSave = splitName || `${FULL_DAY_NAMES[selectedDay]} Workout`;
      if (plannerMode === 'period') {
        if (!activePlan) {
          Alert.alert('Create a Period First', 'Select From & To dates and tap Create Period Plan above.');
          return;
        }
        await upsertPeriodDaySplit(activePlan.id, selectedDay, nameToSave, isRestDay);
      } else {
        await upsertDaySplit(selectedDay, nameToSave, isRestDay);
      }
      Alert.alert('Saved', `${FULL_DAY_NAMES[selectedDay]} split updated.`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save split.');
    }
  };

  const handleAddExercise = async (exerciseId: string) => {
    try {
      const setsCount = Math.min(3, Math.max(1, parseInt(targetSets, 10) || 3));
      const repsText = targetRepRange.trim() || '8-12';
      if (plannerMode === 'period') {
        if (!activePlan) {
          Alert.alert('Create a Period First', 'Select From & To dates and tap Create Period Plan above.');
          return;
        }
        await addExerciseToPeriodDay(activePlan.id, selectedDay, exerciseId, setsCount, repsText);
      } else {
        await addExerciseToDay(selectedDay, exerciseId, setsCount, repsText);
      }
      setPickerOpen(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not add exercise.');
    }
  };

  const handleCreateCustom = async () => {
    if (!customName.trim()) {
      Alert.alert('Name required', 'Enter an exercise name.');
      return;
    }
    try {
      const created = await createCustomExercise(customName, customMuscle, customEquipment);
      if (created) {
        await handleAddExercise(created.id);
        setCustomName('');
        setCustomOpen(false);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create exercise.');
    }
  };

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Mode Toggle at Top */}
      <View style={styles.modeBar}>
        <Pressable
          style={[styles.modePill, plannerMode === 'period' && styles.modePillActive]}
          onPress={() => {
            setPlannerMode('period');
            syncDayFields('period', selectedDay);
          }}
        >
          <Text style={[styles.modeText, plannerMode === 'period' && styles.modeTextActive]}>
            Date Range Plan
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modePill, plannerMode === 'weekly' && styles.modePillActive]}
          onPress={() => {
            setPlannerMode('weekly');
            syncDayFields('weekly', selectedDay);
          }}
        >
          <Text style={[styles.modeText, plannerMode === 'weekly' && styles.modeTextActive]}>
            Weekly Default
          </Text>
        </Pressable>
      </View>

      {/* Day Selector Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayStrip}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {DAY_NAMES.map((label, idx) => {
          const active = idx === selectedDay;
          const hasSplit =
            plannerMode === 'period'
              ? Boolean(activePlan?.days[idx])
              : Boolean(splitsByDay[idx]);
          return (
            <Pressable
              key={label}
              style={[styles.dayPill, active && styles.dayPillActive]}
              onPress={() => handleSelectDay(idx)}
            >
              <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>
                {label}
              </Text>
              {hasSplit && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {plannerMode === 'period' && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={16} color={Colors.gold} />
                <Text style={styles.sectionTitle}>Select Split Dates</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  const day = new Date().getDay();
                  const daysToNextMon = day === 0 ? 1 : 8 - day;
                  const nextMon = addDays(today, daysToNextMon);
                  setFromDate(nextMon);
                  setToDate(addDays(nextMon, 6));
                }}
              >
                <Text style={styles.chipText}>Next Week (Mon–Sun)</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  setFromDate(today);
                  setToDate(addDays(today, 6));
                }}
              >
                <Text style={styles.chipText}>This Week (7d)</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  setFromDate(today);
                  setToDate(addDays(today, 13));
                }}
              >
                <Text style={styles.chipText}>Next 2 Weeks</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  setFromDate(today);
                  setToDate(addDays(today, 29));
                }}
              >
                <Text style={styles.chipText}>30 Days</Text>
              </Pressable>
              <Pressable
                style={styles.chip}
                onPress={() => {
                  setFromDate(addDays(today, -14));
                  setToDate(today);
                }}
              >
                <Text style={styles.chipText}>Past 14 Days</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>From Date</Text>
                <TextInput
                  style={styles.input}
                  value={fromDate}
                  onChangeText={setFromDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>To Date</Text>
                <TextInput
                  style={styles.input}
                  value={toDate}
                  onChangeText={setToDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Plan name (optional, e.g. Nov PPL Block)"
              placeholderTextColor={Colors.textMuted}
              value={planName}
              onChangeText={setPlanName}
            />

            <Pressable style={styles.primaryBtn} onPress={handleCreatePeriod}>
              <Text style={styles.primaryBtnText}>Create Period Plan</Text>
            </Pressable>

            {periodPlans.length > 0 && (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={styles.miniLabel}>Saved Date-Range Plans (tap to edit):</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {periodPlans.map((plan) => {
                    const selected = activePlan?.id === plan.id;
                    return (
                      <View
                        key={plan.id}
                        style={[styles.planChip, selected && styles.planChipActive]}
                      >
                        <Pressable
                          onPress={() => {
                            setSelectedPlanId(plan.id);
                            syncDayFields('period', selectedDay, plan);
                          }}
                        >
                          <Text style={[styles.planChipTitle, selected && { color: Colors.gold }]}>
                            {plan.name}
                          </Text>
                          <Text style={styles.planChipDates}>
                            {plan.startDate} → {plan.endDate}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => deletePeriodPlan(plan.id)}>
                          <X size={14} color={Colors.textMuted} />
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {FULL_DAY_NAMES[selectedDay]}
            {plannerMode === 'period' && activePlan ? ` • ${activePlan.name}` : ''}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Split name (e.g., Push Day, Chest + Triceps)"
            placeholderTextColor={Colors.textMuted}
            value={splitName}
            onChangeText={setSplitName}
          />
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Mark as Rest Day</Text>
            <Switch
              value={isRestDay}
              onValueChange={setIsRestDay}
              trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>
          <Pressable style={styles.primaryBtn} onPress={handleSaveDayHeader}>
            <Text style={styles.primaryBtnText}>Save Day Name</Text>
          </Pressable>
        </View>

        {!isRestDay && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Planned Exercises</Text>
              <Pressable style={styles.addBtn} onPress={() => setPickerOpen(true)}>
                <Plus size={16} color={Colors.primaryText} />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>

            {resolvedExercises.length === 0 ? (
              <Text style={styles.emptyText}>
                No exercises planned yet for {FULL_DAY_NAMES[selectedDay]}. Tap Add to build your
                routine.
              </Text>
            ) : (
              resolvedExercises.map((item, idx) => (
                <View key={item.id} style={styles.exerciseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>
                      {idx + 1}. {item.exercise?.name ?? 'Exercise'}
                    </Text>
                    <Text style={styles.exerciseMeta}>
                      {item.target_sets} sets × {item.target_rep_range} •{' '}
                      {item.exercise?.primary_muscle}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      if (plannerMode === 'period' && activePlan) {
                        void removeExerciseFromPeriodDay(activePlan.id, selectedDay, item.id);
                      } else {
                        void removeExerciseFromDay(item.id);
                      }
                    }}
                  >
                    <Trash2 size={18} color={Colors.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Exercise Picker Modal */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Add Exercise</Text>
              <Pressable onPress={() => setPickerOpen(false)}>
                <X size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Target Sets</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={targetSets}
                  onChangeText={setTargetSets}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Rep Range</Text>
                <TextInput
                  style={styles.input}
                  value={targetRepRange}
                  onChangeText={setTargetRepRange}
                  placeholder="8-12"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Search exercises (e.g. Pec Deck, Incline)..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <Pressable style={styles.linkBtn} onPress={() => setCustomOpen(true)}>
              <Plus size={15} color={Colors.primary} />
              <Text style={styles.linkBtnText}>Create Custom Exercise</Text>
            </Pressable>

            <ScrollView style={{ maxHeight: 340 }}>
              {filteredExercises.map((ex) => (
                <Pressable
                  key={ex.id}
                  style={styles.pickerRow}
                  onPress={() => handleAddExercise(ex.id)}
                >
                  <View>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {ex.primary_muscle} • {ex.equipment}
                    </Text>
                  </View>
                  <Plus size={18} color={Colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Custom Exercise Modal */}
      <Modal visible={customOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>New Custom Exercise</Text>
              <Pressable onPress={() => setCustomOpen(false)}>
                <X size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Exercise Name"
              placeholderTextColor={Colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
            />
            <Text style={styles.miniLabel}>Primary Muscle</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {MUSCLES.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.chip, customMuscle === m && styles.chipActive]}
                    onPress={() => setCustomMuscle(m)}
                  >
                    <Text style={[styles.chipText, customMuscle === m && styles.chipTextActive]}>
                      {m}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.miniLabel}>Equipment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {EQUIPMENTS.map((eq) => (
                  <Pressable
                    key={eq}
                    style={[styles.chip, customEquipment === eq && styles.chipActive]}
                    onPress={() => setCustomEquipment(eq)}
                  >
                    <Text style={[styles.chipText, customEquipment === eq && styles.chipTextActive]}>
                      {eq}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable style={styles.primaryBtn} onPress={handleCreateCustom}>
              <Text style={styles.primaryBtnText}>Create & Add to Split</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  dayStrip: { maxHeight: 58, paddingVertical: 10 },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayPillActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  dayPillText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  dayPillTextActive: { color: Colors.primary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  label: { color: Colors.textSecondary, fontSize: 14 },
  miniLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowGap: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.primaryText, fontWeight: '700', fontSize: 15 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: Colors.primaryText, fontWeight: '700', fontSize: 13 },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  exerciseName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  exerciseMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  linkBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 12 },
  chipTextActive: { color: Colors.primary, fontWeight: '600' },
  modeBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modePillActive: {
    backgroundColor: Colors.goldSoft,
    borderColor: Colors.gold,
  },
  modeText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  modeTextActive: { color: Colors.gold },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planChipActive: {
    backgroundColor: Colors.goldSoft,
    borderColor: Colors.gold,
  },
  planChipTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  planChipDates: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
});
