import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  PauseCircle,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { FULL_DAY_NAMES, useSplit } from '../../hooks/useSplit';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { GymAndroidNative } from '../../native/GymAndroidNative';
import { Colors } from '../../theme/colors';
import { EffortLevel, ExerciseStatus, SetType } from '../../types/database';

const SET_TYPES: { value: SetType; label: string }[] = [
  { value: 'warmup', label: 'Warm-up' },
  { value: 'working', label: 'Working' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Failure' },
];

const EFFORT_LEVELS: { value: EffortLevel; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard', label: 'Hard' },
  { value: 'failure', label: 'Failure' },
];

export default function WorkoutScreen() {
  const router = useRouter();
  const todayIndex = new Date().getDay();
  const { splitsByDay, exercises: allExercises } = useSplit();
  const todaySplit = splitsByDay[todayIndex];

  const {
    session,
    sessionExercises,
    sets,
    previousByExercise,
    weightPreKg,
    weightPostKg,
    startTodayWorkout,
    addExerciseToSession,
    setExerciseStatus,
    logSet,
    deleteSet,
    finishWorkout,
    saveWorkoutWeight,
  } = useWorkoutSession(todaySplit);

  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [setType, setSetType] = useState<SetType>('working');
  const [effort, setEffort] = useState<EffortLevel>('moderate');

  const [preInput, setPreInput] = useState('');
  const [postInput, setPostInput] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session) {
        void (async () => {
          const pending = await GymAndroidNative.consumePendingLogs();
          for (const s of pending.sets) {
            if (s.exerciseId && s.exerciseId !== 'freestyle') {
              await logSet({
                exerciseId: s.exerciseId,
                weightKg: s.weightKg,
                reps: s.reps,
                setType: 'working',
                effort: 'moderate',
              });
            }
          }
        })();
      }
    });
    return () => sub.remove();
  }, [logSet, session]);

  const sweatLoss = useMemo(() => {
    if (weightPreKg && weightPostKg) {
      return (weightPreKg - weightPostKg).toFixed(2);
    }
    return null;
  }, [weightPreKg, weightPostKg]);

  const handleSelectExercise = async (exerciseId: string, currentStatus: ExerciseStatus) => {
    if (expandedExerciseId === exerciseId) {
      setExpandedExerciseId(null);
      return;
    }
    setExpandedExerciseId(exerciseId);

    // Pre-fill from last set in this session or previous session
    const sessionExSets = sets.filter((s) => s.exercise_id === exerciseId);
    const lastSet = sessionExSets[sessionExSets.length - 1];
    if (lastSet) {
      setWeightInput(String(lastSet.weight_kg));
      setRepsInput(String(lastSet.reps));
    } else if (previousByExercise[exerciseId]) {
      setWeightInput(String(previousByExercise[exerciseId].weight_kg));
      setRepsInput(String(previousByExercise[exerciseId].reps));
    } else {
      setWeightInput('');
      setRepsInput('');
    }

    if (currentStatus === 'pending') {
      await setExerciseStatus(exerciseId, 'in_progress');
    }
  };

  const handleLogSet = async (exerciseId: string) => {
    const w = parseFloat(weightInput) || 0;
    const r = parseInt(repsInput, 10) || 0;
    if (r <= 0) {
      Alert.alert('Invalid Reps', 'Enter at least 1 rep.');
      return;
    }

    try {
      await logSet({ exerciseId, weightKg: w, reps: r, setType, effort });
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not log set.');
    }
  };

  const handleSaveWeight = async (type: 'pre' | 'post') => {
    const raw = type === 'pre' ? preInput : postInput;
    const parsed = parseFloat(raw);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    await saveWorkoutWeight(type, parsed);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getStatusBadge = (status: ExerciseStatus) => {
    if (status === 'completed') {
      return {
        label: 'Done',
        bg: Colors.successSoft,
        color: Colors.success,
        icon: <CheckCircle2 size={14} color={Colors.success} />,
      };
    }
    if (status === 'in_progress') {
      return {
        label: 'In Progress',
        bg: Colors.amberSoft,
        color: Colors.amber,
        icon: <PauseCircle size={14} color={Colors.amber} />,
      };
    }
    return {
      label: 'Pending',
      bg: Colors.surfaceElevated,
      color: Colors.textSecondary,
      icon: <Clock size={14} color={Colors.textSecondary} />,
    };
  };

  const handleLaunchOverlay = async () => {
    if (!GymAndroidNative.isSupported()) {
      Alert.alert(
        'Android APK Feature',
        'The Floating Mini-Logger Overlay runs in the compiled Android .apk build.'
      );
      return;
    }
    const allowed = await GymAndroidNative.hasOverlayPermission();
    if (!allowed) {
      Alert.alert(
        'Overlay Permission Needed',
        'Enable "Display over other apps" so the gym bubble can float over YouTube.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => GymAndroidNative.requestOverlayPermission() },
        ]
      );
      return;
    }
    const activeEx =
      sessionExercises.find((e) => e.exercise_id === expandedExerciseId) ??
      sessionExercises[0];
    GymAndroidNative.startFloatingOverlay(
      activeEx?.exercise_id ?? 'freestyle',
      activeEx?.exercise?.name ?? 'Freestyle Set',
      parseFloat(weightInput) || 20,
      parseInt(repsInput, 10) || 10
    );
  };

  const filteredAddExercises = allExercises.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header & Split Shortcut */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.dayLabel}>{FULL_DAY_NAMES[todayIndex]}</Text>
          <Text style={styles.title}>
            {todaySplit?.split.split_name ?? 'No Split Planned'}
          </Text>
        </View>
        <View style={styles.rowGapSmall}>
          <Pressable
            style={styles.outlineBtn}
            onPress={handleLaunchOverlay}
          >
            <Text style={styles.outlineBtnText}>Overlay</Text>
          </Pressable>
          <Pressable
            style={styles.outlineBtn}
            onPress={() => router.push('/split-planner')}
          >
            <Calendar size={16} color={Colors.primary} />
            <Text style={styles.outlineBtnText}>Edit Split</Text>
          </Pressable>
        </View>
      </View>

      {/* Pre & Post Workout Weight Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Workout Body Weight (kg)</Text>
          {sweatLoss !== null && (
            <Text style={styles.sweatBadge}>Sweat Δ: {sweatLoss} kg</Text>
          )}
        </View>
        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>
              Pre-Workout {weightPreKg ? `(${weightPreKg} kg)` : ''}
            </Text>
            <View style={styles.inlineInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="e.g. 74.5"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={preInput}
                onChangeText={setPreInput}
              />
              <Pressable style={styles.miniSaveBtn} onPress={() => handleSaveWeight('pre')}>
                <Text style={styles.miniSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>
              Post-Workout {weightPostKg ? `(${weightPostKg} kg)` : ''}
            </Text>
            <View style={styles.inlineInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="e.g. 74.1"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={postInput}
                onChangeText={setPostInput}
              />
              <Pressable style={styles.miniSaveBtn} onPress={() => handleSaveWeight('post')}>
                <Text style={styles.miniSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Start Session OR Active Non-Linear Exercise List */}
      {!session ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ready to Train?</Text>
          <Text style={styles.mutedText}>
            {todaySplit && todaySplit.exercises.length > 0
              ? `${todaySplit.exercises.length} exercises loaded from your ${todaySplit.split.split_name} template. You can switch exercises in any order during your workout.`
              : 'No split exercises planned for today. Start a freestyle session or edit your weekly split.'}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={startTodayWorkout}>
            <Play size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Start Today&apos;s Workout</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionHeader}>
              Exercises ({sessionExercises.filter((e) => e.status === 'completed').length}/
              {sessionExercises.length} Done)
            </Text>
            <Pressable style={styles.linkBtn} onPress={() => setAddModalOpen(true)}>
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.linkBtnText}>Add Exercise</Text>
            </Pressable>
          </View>

          {sessionExercises.map((se) => {
            const exSets = sets.filter((s) => s.exercise_id === se.exercise_id);
            const isExpanded = expandedExerciseId === se.exercise_id;
            const badge = getStatusBadge(se.status);
            const prev = previousByExercise[se.exercise_id];

            return (
              <View
                key={se.id}
                style={[
                  styles.exerciseCard,
                  isExpanded && styles.exerciseCardExpanded,
                ]}
              >
                <Pressable
                  style={styles.rowBetween}
                  onPress={() => handleSelectExercise(se.exercise_id, se.status)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{se.exercise?.name ?? 'Exercise'}</Text>
                    <Text style={styles.exerciseSub}>
                      {exSets.length} sets logged
                      {prev ? `  •  Last: ${prev.weight_kg}kg × ${prev.reps}` : ''}
                    </Text>
                  </View>

                  <View style={styles.rowGapSmall}>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      {badge.icon}
                      <Text style={[styles.statusText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={18} color={Colors.textSecondary} />
                    ) : (
                      <ChevronDown size={18} color={Colors.textSecondary} />
                    )}
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.expandedBody}>
                    {/* Logged Sets */}
                    {exSets.map((s, idx) => (
                      <View key={s.id} style={styles.setRow}>
                        <Text style={styles.setNum}>#{idx + 1}</Text>
                        <Text style={styles.setWeight}>
                          {s.weight_kg} kg × {s.reps}
                        </Text>
                        <View style={styles.tagPill}>
                          <Text style={styles.tagText}>{s.set_type}</Text>
                        </View>
                        <View style={styles.tagPill}>
                          <Text style={styles.tagText}>{s.effort}</Text>
                        </View>
                        <Pressable onPress={() => deleteSet(s.id)}>
                          <Trash2 size={15} color={Colors.danger} />
                        </Pressable>
                      </View>
                    ))}

                    {/* Inline Set Logger */}
                    <View style={styles.loggerBox}>
                      <View style={styles.rowGap}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>Weight (kg)</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="0"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="decimal-pad"
                            value={weightInput}
                            onChangeText={setWeightInput}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>Reps</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="10"
                            placeholderTextColor={Colors.textMuted}
                            keyboardType="number-pad"
                            value={repsInput}
                            onChangeText={setRepsInput}
                          />
                        </View>
                      </View>

                      <Text style={styles.miniLabel}>Set Type</Text>
                      <View style={styles.pillRow}>
                        {SET_TYPES.map((st) => (
                          <Pressable
                            key={st.value}
                            style={[styles.chip, setType === st.value && styles.chipActive]}
                            onPress={() => setSetType(st.value)}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                setType === st.value && styles.chipTextActive,
                              ]}
                            >
                              {st.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={styles.miniLabel}>Effort</Text>
                      <View style={styles.pillRow}>
                        {EFFORT_LEVELS.map((ef) => (
                          <Pressable
                            key={ef.value}
                            style={[styles.chip, effort === ef.value && styles.chipActive]}
                            onPress={() => setEffort(ef.value)}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                effort === ef.value && styles.chipTextActive,
                              ]}
                            >
                              {ef.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <View style={styles.rowGap}>
                        <Pressable
                          style={[styles.primaryBtn, { flex: 1 }]}
                          onPress={() => handleLogSet(se.exercise_id)}
                        >
                          <Plus size={16} color="#fff" />
                          <Text style={styles.primaryBtnText}>Log Set</Text>
                        </Pressable>

                        <Pressable
                          style={styles.doneBtn}
                          onPress={() =>
                            setExerciseStatus(
                              se.exercise_id,
                              se.status === 'completed' ? 'in_progress' : 'completed'
                            )
                          }
                        >
                          <CheckCircle2 size={16} color={Colors.success} />
                          <Text style={styles.doneBtnText}>
                            {se.status === 'completed' ? 'Resume' : 'Done'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          {session.status !== 'completed' ? (
            <Pressable style={styles.finishBtn} onPress={finishWorkout}>
              <CheckCircle2 size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Finish Workout</Text>
            </Pressable>
          ) : (
            <View style={styles.completedBanner}>
              <CheckCircle2 size={18} color={Colors.success} />
              <Text style={styles.completedText}>Workout Completed! Great session.</Text>
            </View>
          )}
        </>
      )}

      {/* Add Exercise to Active Session Modal */}
      <Modal visible={addModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Add Exercise to Session</Text>
              <Pressable onPress={() => setAddModalOpen(false)}>
                <X size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Search exercise..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <ScrollView style={{ maxHeight: 360 }}>
              {filteredAddExercises.map((ex) => (
                <Pressable
                  key={ex.id}
                  style={styles.pickerRow}
                  onPress={async () => {
                    await addExerciseToSession(ex);
                    setExpandedExerciseId(ex.id);
                    setAddModalOpen(false);
                  }}
                >
                  <View>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseSub}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: Colors.text, fontSize: 22, fontWeight: '700', marginTop: 2 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  outlineBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  sweatBadge: { color: Colors.amber, fontSize: 12, fontWeight: '600' },
  mutedText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowGap: { flexDirection: 'row', gap: 10 },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  inlineInputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  miniSaveBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniSaveText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exerciseCardExpanded: {
    borderColor: Colors.primary,
  },
  exerciseName: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  exerciseSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  expandedBody: { marginTop: 14, gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  setNum: { color: Colors.textMuted, fontWeight: '700', width: 26 },
  setWeight: { color: Colors.text, fontWeight: '700', fontSize: 14, flex: 1 },
  tagPill: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
  },
  tagText: { color: Colors.textSecondary, fontSize: 11, textTransform: 'capitalize' },
  loggerBox: { gap: 10, marginTop: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  chipTextActive: { color: Colors.primary, fontWeight: '700' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.successSoft,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  doneBtnText: { color: Colors.success, fontWeight: '700', fontSize: 13 },
  finishBtn: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.successSoft,
    padding: 14,
    borderRadius: 12,
  },
  completedText: { color: Colors.success, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
