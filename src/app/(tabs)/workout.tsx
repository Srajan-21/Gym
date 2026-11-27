import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  X,
} from 'lucide-react-native';
import {
  formatReadableDate,
  getDayOfWeekFromDate,
  useSelectedDate,
} from '../../context/DateContext';
import { getCachedJson, getTodayDateString, setCachedJson } from '../../lib/storage';
import { useDailyHabits } from '../../hooks/useDailyHabits';
import { FULL_DAY_NAMES, useSplit } from '../../hooks/useSplit';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { formatSetDisplay } from '../../lib/workoutFormat';
import { GymAndroidNative } from '../../native/GymAndroidNative';
import { Colors } from '../../theme/colors';
import { PoseTag } from '../../types/database';

type FlowStage =
  | 'idle'
  | 'pre_weight'
  | 'pre_warmup'
  | 'exercises'
  | 'post_exercises_choice'
  | 'cardio'
  | 'post_weight'
  | 'cooldown_photo';

export default function WorkoutScreen() {
  const router = useRouter();
  const { selectedDate, resetToToday } = useSelectedDate();
  const todayIndex = getDayOfWeekFromDate(selectedDate);
  const isLockedFuture = selectedDate > getTodayDateString() && todayIndex !== 0;
  const { getSplitForDate } = useSplit();
  const { data: todaySplit } = getSplitForDate(selectedDate);

  const {
    session,
    sessionExercises,
    sets,
    previousByExercise,
    weightPreKg,
    weightPostKg,
    startTodayWorkout,
    addExerciseByName,
    reorderSessionExercises,
    setExerciseStatus,
    logSet,
    finishWorkout,
    saveWorkoutWeight,
  } = useWorkoutSession(todaySplit);

  const { addProgressPhoto, uploadingPhoto, todayPhotos } = useDailyHabits();

  const [stage, setStage] = useState<FlowStage>('idle');
  const [preWeightInput, setPreWeightInput] = useState('');
  const [postWeightInput, setPostWeightInput] = useState('');
  const [preWarmupDone, setPreWarmupDone] = useState(false);
  const [postWarmupDone, setPostWarmupDone] = useState(false);

  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [repsInput, setRepsInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [adHocMap, setAdHocMap] = useState<Record<string, boolean>>({});

  // Reorder & Add modal
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [swapSourceIdx, setSwapSourceIdx] = useState<number | null>(null);
  const [newExName, setNewExName] = useState('');
  const [postNewExName, setPostNewExName] = useState('');
  const [warmupExtraName, setWarmupExtraName] = useState('');

  // Zero-rep ("Not done") reason modal state
  const [setReasons, setSetReasons] = useState<Record<string, string>>({});
  const [pendingZeroSet, setPendingZeroSet] = useState<{
    action: 'auto' | 'next_set' | 'next_exercise';
    weight: number;
  } | null>(null);
  const [zeroReasonInput, setZeroReasonInput] = useState('');

  useEffect(() => {
    void getCachedJson<Record<string, string>>('gym_zero_set_reasons_v1').then((saved) => {
      if (saved) setSetReasons(saved);
    });
  }, []);

  // Cardio timer state
  const [cardioName, setCardioName] = useState('Walking');
  const [cardioSeconds, setCardioSeconds] = useState(0);
  const [cardioRunning, setCardioRunning] = useState(false);
  const [loggedCardios, setLoggedCardios] = useState<{ name: string; mins: number }[]>([]);

  useEffect(() => {
    if (!cardioRunning) return;
    const id = setInterval(() => setCardioSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [cardioRunning]);

  useEffect(() => {
    let syncing = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session && !syncing) {
        syncing = true;
        void (async () => {
          try {
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
          } finally {
            syncing = false;
          }
        })();
      }
    });
    return () => sub.remove();
  }, [logSet, session]);

  const currentEx = sessionExercises[currentExIdx];
  const nextEx = sessionExercises[currentExIdx + 1];
  const prevExSummary = currentEx ? previousByExercise[currentEx.exercise_id] : undefined;

  const currentExSets = useMemo(() => {
    if (!currentEx) return [];
    return sets.filter((s) => s.exercise_id === currentEx.exercise_id);
  }, [currentEx, sets]);

  const plannedTargetSets = useMemo(() => {
    if (!currentEx || !todaySplit) return 3;
    const match = todaySplit.exercises.find((e) => e.exercise_id === currentEx.exercise_id);
    return Math.max(1, match?.target_sets ?? 3);
  }, [currentEx, todaySplit]);

  const isAdHocCurrent = currentEx ? Boolean(adHocMap[currentEx.exercise_id]) : false;

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
    GymAndroidNative.startFloatingOverlay(
      currentEx?.exercise_id ?? 'freestyle',
      currentEx?.exercise?.name ?? 'Freestyle Set',
      parseFloat(weightInput) || 20,
      parseInt(repsInput, 10) || 10
    );
  };

  const handleStartFlow = async () => {
    if (!session) {
      await startTodayWorkout();
    }
    setPreWeightInput(weightPreKg != null ? String(weightPreKg) : '');
    setPostWeightInput(weightPostKg != null ? String(weightPostKg) : '');
    setStage('pre_weight');
  };

  const handleSavePreWeight = async (skip = false) => {
    if (!skip && preWeightInput.trim()) {
      const parsed = parseFloat(preWeightInput);
      if (Number.isNaN(parsed) || parsed <= 0) {
        Alert.alert('Invalid Weight', 'Enter a valid weight in kg.');
        return;
      }
      await saveWorkoutWeight('pre', parsed);
    }
    setStage('pre_warmup');
  };

  const handleAddExtraExerciseAndJump = async (rawName: string, markAdHoc = true) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    if (!session) await startTodayWorkout();
    const added = await addExerciseByName(trimmed);
    if (added) {
      if (markAdHoc) {
        setAdHocMap((prev) => ({ ...prev, [added.exercise_id]: true }));
      }
      const nextIdx = sessionExercises.findIndex((se) => se.exercise_id === added.exercise_id);
      setCurrentExIdx(nextIdx >= 0 ? nextIdx : sessionExercises.length);
      setRepsInput('');
      setWeightInput('');
      setStage('exercises');
    }
  };

  const handleSameWeight = () => {
    const lastSet = currentExSets[currentExSets.length - 1];
    if (lastSet) {
      setWeightInput(String(lastSet.weight_kg));
    } else {
      Alert.alert('No Previous Set', 'Log Set 1 weight first to reuse it.');
    }
  };

  const advanceToNextExerciseOrFinish = () => {
    setRepsInput('');
    setWeightInput('');
    if (currentExIdx + 1 < sessionExercises.length) {
      setCurrentExIdx((i) => i + 1);
    } else {
      setStage('post_exercises_choice');
    }
  };

  const handleCompleteSet = async (action: 'auto' | 'next_set' | 'next_exercise') => {
    if (!currentEx) return;
    const reps = parseInt(repsInput, 10);
    const weight = parseFloat(weightInput) || 0;

    if (action === 'next_exercise' && (!repsInput.trim() || Number.isNaN(reps) || reps < 0)) {
      await setExerciseStatus(currentEx.exercise_id, 'completed');
      advanceToNextExerciseOrFinish();
      return;
    }

    if (Number.isNaN(reps) || reps < 0) {
      Alert.alert('Enter Reps', 'Fill in repetitions (0 if set was not done).');
      return;
    }

    if (reps === 0) {
      setZeroReasonInput('');
      setPendingZeroSet({ action, weight });
      return;
    }

    await logSet({
      exerciseId: currentEx.exercise_id,
      weightKg: weight,
      reps,
      setType: 'working',
      effort: 'moderate',
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRepsInput('');

    const completedCount =
      currentExSets.filter((s) => s.reps > 0).length + (reps > 0 ? 1 : 0);
    if (action === 'next_exercise') {
      await setExerciseStatus(currentEx.exercise_id, 'completed');
      advanceToNextExerciseOrFinish();
    } else if (action === 'next_set') {
      // Stay on current exercise for next set
    } else if (!isAdHocCurrent && completedCount >= plannedTargetSets) {
      await setExerciseStatus(currentEx.exercise_id, 'completed');
      advanceToNextExerciseOrFinish();
    }
  };

  const handleConfirmZeroSet = async () => {
    if (!currentEx || !pendingZeroSet) return;
    const reason = zeroReasonInput.trim();
    if (!reason) {
      Alert.alert('Reason Required', 'Select or type why this set was not done.');
      return;
    }
    const inserted = await logSet({
      exerciseId: currentEx.exercise_id,
      weightKg: pendingZeroSet.weight,
      reps: 0,
      setType: 'working',
      effort: 'moderate',
    });
    if (inserted?.id) {
      const next = { ...setReasons, [inserted.id]: reason };
      setSetReasons(next);
      void setCachedJson('gym_zero_set_reasons_v1', next);
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRepsInput('');
    const action = pendingZeroSet.action;
    setPendingZeroSet(null);
    setZeroReasonInput('');
    if (action === 'next_exercise') {
      await setExerciseStatus(currentEx.exercise_id, 'completed');
      advanceToNextExerciseOrFinish();
    }
  };

  const handleSwapOrMove = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= sessionExercises.length || fromIdx === toIdx) return;
    const copy = [...sessionExercises];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    await reorderSessionExercises(copy);
    if (currentExIdx === fromIdx) setCurrentExIdx(toIdx);
    setSwapSourceIdx(null);
  };

  const handleAddCardioEntry = async (andContinue: boolean) => {
    setCardioRunning(false);
    const mins = Math.max(1, Math.round(cardioSeconds / 60));
    if (cardioSeconds > 0 || cardioName.trim()) {
      const label = cardioName.trim() || 'Cardio';
      const added = await addExerciseByName(label, 'cardio');
      if (added) {
        await logSet({
          exerciseId: added.exercise_id,
          weightKg: 0,
          reps: mins,
          setType: 'working',
          effort: 'moderate',
        });
        await setExerciseStatus(added.exercise_id, 'completed');
      }
      setLoggedCardios((prev) => [...prev, { name: label, mins }]);
    }
    setCardioSeconds(0);
    setCardioName('');
    if (andContinue) {
      setStage('post_weight');
    }
  };

  const handleSavePostWeight = async (skip = false) => {
    if (!skip && postWeightInput.trim()) {
      const parsed = parseFloat(postWeightInput);
      if (Number.isNaN(parsed) || parsed <= 0) {
        Alert.alert('Invalid Weight', 'Enter a valid weight in kg.');
        return;
      }
      await saveWorkoutWeight('post', parsed);
    }
    setStage('cooldown_photo');
  };

  const handlePickPhoto = async (useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Allow camera/gallery access to upload progress photos.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });

    if (result.canceled || !result.assets[0]) return;
    try {
      const tag: PoseTag = 'pump';
      await addProgressPhoto(result.assets[0].uri, tag, result.assets[0].base64);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Uploaded', 'Progress photo saved for today.');
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Upload error.');
    }
  };

  const handleFinishAll = async () => {
    await finishWorkout();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStage('idle');
    router.replace('/(tabs)');
  };

  const formatTimer = (totalSec: number) => {
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Very Top Header: Date + Overlay Button Only (No Calendar) */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.dayLabel}>
            {formatReadableDate(selectedDate)} • {FULL_DAY_NAMES[todayIndex]}
          </Text>
          <Text style={styles.title}>{todaySplit?.split.split_name ?? 'Workout'}</Text>
        </View>
        <Pressable style={styles.overlayBtn} onPress={handleLaunchOverlay}>
          <Text style={styles.overlayBtnText}>Overlay</Text>
        </Pressable>
      </View>

      {/* IDLE / START SCREEN */}
      {isLockedFuture ? (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>FUTURE DATE</Text>
          <Text style={styles.cardTitle}>Phle aaj ka workout krle! 💪</Text>
          <Text style={styles.muted}>
            {formatReadableDate(selectedDate)} is in the future. Complete today&apos;s workout first.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={resetToToday}>
            <Text style={styles.primaryBtnText}>Go to Today</Text>
          </Pressable>
        </View>
      ) : stage === 'idle' && (todayIndex === 0 || todaySplit?.split.is_rest_day) && !session ? (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>SUNDAY • REST &amp; PLANNING DAY</Text>
          <Text style={styles.cardTitle}>Rest Day — Plan Next Week</Text>
          <Text style={styles.muted}>
            Sundays are for recovery and planning next week&apos;s workout split, calorie targets, and
            goals.
          </Text>
          <View style={styles.rowGap}>
            <Pressable
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={() => router.push('/split-planner')}
            >
              <Text style={styles.primaryBtnText}>Plan Next Week Split</Text>
            </Pressable>
            <Pressable
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => router.push('/(tabs)/diet')}
            >
              <Text style={styles.outlineBtnText}>Set Targets</Text>
            </Pressable>
          </View>
          <Pressable onPress={handleStartFlow}>
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>
              Or tap here to start a freestyle workout anyway
            </Text>
          </Pressable>
        </View>
      ) : stage === 'idle' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {session?.status === 'completed'
              ? 'Workout Completed'
              : session
                ? 'Workout Ready'
                : "Today's Exercises"}
          </Text>
          {(todaySplit?.exercises ?? []).length > 0 ? (
            <View style={{ gap: 6 }}>
              {todaySplit?.exercises.map((item, idx) => (
                <Text key={item.id} style={styles.listItem}>
                  {idx + 1}. {item.exercise?.name ?? 'Exercise'} • {item.target_sets} sets
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No split planned for today. You can still start and add exercises.</Text>
          )}
          <Pressable style={styles.primaryBtn} onPress={handleStartFlow}>
            <Play size={18} color={Colors.primaryText} />
            <Text style={styles.primaryBtnText}>
              {session ? 'Continue / Start Workout' : 'Start Workout'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* STAGE 1: PRE-WORKOUT WEIGHT */}
      {stage === 'pre_weight' && (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>STEP 1 • PRE-WORKOUT WEIGHT</Text>
          <Text style={styles.cardTitle}>Enter Pre-Workout Weight (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="e.g. 79.8"
            placeholderTextColor={Colors.textMuted}
            value={preWeightInput}
            onChangeText={setPreWeightInput}
          />
          <View style={styles.rowGap}>
            <Pressable style={[styles.outlineBtn, { flex: 1 }]} onPress={() => handleSavePreWeight(true)}>
              <Text style={styles.outlineBtnText}>Skip</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { flex: 2 }]} onPress={() => handleSavePreWeight(false)}>
              <Text style={styles.primaryBtnText}>Save & Continue</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* STAGE 2: WARM-UP TICK + OPTIONAL PLANK/EXERCISE */}
      {stage === 'pre_warmup' && (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>STEP 2 • WARM-UP</Text>
          <Text style={styles.cardTitle}>Did you complete your warm-up?</Text>
          <Pressable
            style={[styles.checkRow, preWarmupDone && styles.checkRowActive]}
            onPress={() => setPreWarmupDone((v) => !v)}
          >
            <View style={[styles.checkBox, preWarmupDone && styles.checkBoxActive]}>
              {preWarmupDone && <Check size={14} color={Colors.primaryText} />}
            </View>
            <Text style={styles.checkLabel}>Yes, warm-up completed</Text>
          </Pressable>

          <Text style={styles.miniLabel}>Want to add Plank or another exercise first?</Text>
          <View style={styles.rowGap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. Plank"
              placeholderTextColor={Colors.textMuted}
              value={warmupExtraName}
              onChangeText={setWarmupExtraName}
            />
            <Pressable
              style={styles.outlineBtn}
              onPress={async () => {
                if (!warmupExtraName.trim()) return;
                await handleAddExtraExerciseAndJump(warmupExtraName, true);
                setWarmupExtraName('');
              }}
            >
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.outlineBtnText}>Add</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              setCurrentExIdx(0);
              setStage(sessionExercises.length > 0 ? 'exercises' : 'post_exercises_choice');
            }}
          >
            <Text style={styles.primaryBtnText}>Start Exercises</Text>
          </Pressable>
        </View>
      )}

      {/* STAGE 3: ACTIVE EXERCISE */}
      {stage === 'exercises' && currentEx && (
        <View style={{ gap: 14 }}>
          {prevExSummary && prevExSummary.sets.length > 0 && (
            <View style={styles.prevBanner}>
              <Text style={styles.prevKicker}>
                LAST SESSION ({formatReadableDate(prevExSummary.logDate).toUpperCase()})
              </Text>
              <View style={styles.prevSetsRow}>
                {prevExSummary.sets.map((ps, idx) => (
                  <View key={idx} style={styles.prevSetChip}>
                    <Text style={styles.prevSetChipText}>
                      S{idx + 1}: {formatSetDisplay(currentEx.exercise?.name, ps.weight_kg, ps.reps)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.stepKicker}>
                EXERCISE {currentExIdx + 1} OF {sessionExercises.length}
              </Text>
              <View style={styles.rowGapSmall}>
                <Pressable
                  style={[styles.exNavBtn, currentExIdx === 0 && { opacity: 0.35 }]}
                  disabled={currentExIdx === 0}
                  onPress={() => {
                    setRepsInput('');
                    setWeightInput('');
                    setCurrentExIdx((i) => Math.max(0, i - 1));
                  }}
                >
                  <ChevronLeft size={18} color={Colors.text} />
                </Pressable>
                <Pressable
                  style={styles.exNavBtn}
                  onPress={() => {
                    setRepsInput('');
                    setWeightInput('');
                    advanceToNextExerciseOrFinish();
                  }}
                >
                  <ChevronRight size={18} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.exerciseTitle}>{currentEx.exercise?.name ?? 'Exercise'}</Text>

            {/* Fixed Completed Sets */}
            {currentExSets.map((s, idx) => (
              <View key={s.id} style={styles.lockedSetRow}>
                <Text style={styles.lockedSetText}>Set {idx + 1}</Text>
                <Text
                  style={[
                    styles.lockedSetVal,
                    s.reps === 0 && { color: Colors.amber },
                  ]}
                >
                  {formatSetDisplay(currentEx.exercise?.name, Number(s.weight_kg), s.reps)}
                  {s.reps === 0 && setReasons[s.id] ? ` — ${setReasons[s.id]}` : ''}
                  {s.reps > 0 ? ' ✓' : ''}
                </Text>
              </View>
            ))}

            {/* Current Set Input */}
            <View style={styles.activeSetBox}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Set {currentExSets.length + 1}</Text>
                {currentExSets.length > 0 && (
                  <Pressable style={styles.sameWeightBtn} onPress={handleSameWeight}>
                    <Text style={styles.sameWeightText}>Same Weight</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Repetitions</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="e.g. 15"
                    placeholderTextColor={Colors.textMuted}
                    value={repsInput}
                    onChangeText={setRepsInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 18"
                    placeholderTextColor={Colors.textMuted}
                    value={weightInput}
                    onChangeText={setWeightInput}
                  />
                </View>
              </View>

              {isAdHocCurrent ? (
                <View style={styles.rowGap}>
                  <Pressable
                    style={[styles.outlineBtn, { flex: 1 }]}
                    onPress={() => void handleCompleteSet('next_set')}
                  >
                    <Plus size={15} color={Colors.primary} />
                    <Text style={styles.outlineBtnText}>Next Set</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, { flex: 1 }]}
                    onPress={() => void handleCompleteSet('next_exercise')}
                  >
                    <Text style={styles.primaryBtnText}>Next Exercise</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => void handleCompleteSet('auto')}
                >
                  <Check size={17} color={Colors.primaryText} />
                  <Text style={styles.primaryBtnText}>
                    Done Set {currentExSets.length + 1} / {plannedTargetSets}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Up Next + Reorder/Add Modal Trigger */}
          <View style={styles.card}>
            <Text style={styles.miniLabel}>
              {nextEx
                ? `Up Next: ${nextEx.exercise?.name ?? 'Next Exercise'}`
                : 'Last exercise in your list'}
            </Text>
            <Pressable
              style={styles.outlineBtn}
              onPress={() => {
                setSwapSourceIdx(null);
                setOrderModalOpen(true);
              }}
            >
              <ArrowUpDown size={16} color={Colors.primary} />
              <Text style={styles.outlineBtnText}>Change Order / Add Exercise</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* STAGE 4: ALL EXERCISES DONE -> NEW EXERCISE OR CARDIO/COOLDOWN */}
      {stage === 'post_exercises_choice' && (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>ALL EXERCISES DONE</Text>
          <Text style={styles.cardTitle}>Add another exercise or move to Cardio?</Text>
          <View style={styles.rowGap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="New exercise name..."
              placeholderTextColor={Colors.textMuted}
              value={postNewExName}
              onChangeText={setPostNewExName}
            />
            <Pressable
              style={styles.outlineBtn}
              onPress={async () => {
                if (!postNewExName.trim()) return;
                await handleAddExtraExerciseAndJump(postNewExName, true);
                setPostNewExName('');
              }}
            >
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.outlineBtnText}>Add</Text>
            </Pressable>
          </View>
          <Pressable style={styles.primaryBtn} onPress={() => setStage('cardio')}>
            <Text style={styles.primaryBtnText}>Proceed to Cardio & Cool-down</Text>
          </Pressable>
        </View>
      )}

      {/* STAGE 5: CARDIO TIMER */}
      {stage === 'cardio' && (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>CARDIO TIMER</Text>
          <Text style={styles.cardTitle}>What cardio are you doing?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Walking, Cycling, Treadmill"
            placeholderTextColor={Colors.textMuted}
            value={cardioName}
            onChangeText={setCardioName}
          />

          <Text style={styles.timerDisplay}>{formatTimer(cardioSeconds)}</Text>

          <View style={styles.rowGap}>
            <Pressable
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => setCardioRunning((r) => !r)}
            >
              {cardioRunning ? (
                <Pause size={16} color={Colors.primary} />
              ) : (
                <Play size={16} color={Colors.primary} />
              )}
              <Text style={styles.outlineBtnText}>{cardioRunning ? 'Pause' : 'Start'}</Text>
            </Pressable>
            <Pressable
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => {
                setCardioRunning(false);
                setCardioSeconds(0);
              }}
            >
              <RotateCcw size={16} color={Colors.primary} />
              <Text style={styles.outlineBtnText}>Restart</Text>
            </Pressable>
          </View>

          {loggedCardios.length > 0 && (
            <View style={{ gap: 4 }}>
              {loggedCardios.map((c, idx) => (
                <Text key={idx} style={styles.muted}>
                  ✓ {c.name}: {c.mins} min
                </Text>
              ))}
            </View>
          )}

          <View style={styles.rowGap}>
            <Pressable
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => void handleAddCardioEntry(false)}
            >
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.outlineBtnText}>Add Next Cardio</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={() => void handleAddCardioEntry(true)}
            >
              <Square size={15} color={Colors.primaryText} />
              <Text style={styles.primaryBtnText}>Submit & Next</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* STAGE 6: POST-WORKOUT WEIGHT */}
      {stage === 'post_weight' && (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>POST-WORKOUT WEIGHT</Text>
          <Text style={styles.cardTitle}>Take & Enter Post-Workout Weight (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="e.g. 79.4"
            placeholderTextColor={Colors.textMuted}
            value={postWeightInput}
            onChangeText={setPostWeightInput}
          />
          <View style={styles.rowGap}>
            <Pressable style={[styles.outlineBtn, { flex: 1 }]} onPress={() => handleSavePostWeight(true)}>
              <Text style={styles.outlineBtnText}>Skip</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { flex: 2 }]} onPress={() => handleSavePostWeight(false)}>
              <Text style={styles.primaryBtnText}>Save Weight & Continue</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* STAGE 7: COOL-DOWN / WARM-UP TICK + PHOTO + FINISH */}
      {stage === 'cooldown_photo' && (
        <View style={styles.card}>
          <Text style={styles.stepKicker}>FINAL STEP • COOL-DOWN & PHOTO</Text>
          <Text style={styles.cardTitle}>Cool-down & Progress Photo</Text>

          <Pressable
            style={[styles.checkRow, postWarmupDone && styles.checkRowActive]}
            onPress={() => setPostWarmupDone((v) => !v)}
          >
            <View style={[styles.checkBox, postWarmupDone && styles.checkBoxActive]}>
              {postWarmupDone && <Check size={14} color={Colors.primaryText} />}
            </View>
            <Text style={styles.checkLabel}>Post-workout warm-up / stretching done</Text>
          </Pressable>

          <View style={styles.rowGap}>
            <Pressable
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => handlePickPhoto(true)}
              disabled={uploadingPhoto}
            >
              <Camera size={16} color={Colors.primary} />
              <Text style={styles.outlineBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable
              style={[styles.outlineBtn, { flex: 1 }]}
              onPress={() => handlePickPhoto(false)}
              disabled={uploadingPhoto}
            >
              <Text style={styles.outlineBtnText}>Gallery ({todayPhotos.length})</Text>
            </Pressable>
          </View>
          {uploadingPhoto && <ActivityIndicator size="small" color={Colors.amber} />}

          <Pressable style={styles.primaryBtn} onPress={handleFinishAll}>
            <CheckCircle2 size={18} color={Colors.primaryText} />
            <Text style={styles.primaryBtnText}>Finish & Save Workout</Text>
          </Pressable>
        </View>
      )}

      {/* REORDER & ADD EXERCISE MODAL */}
      <Modal visible={orderModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Reorder / Add Exercises</Text>
              <Pressable onPress={() => setOrderModalOpen(false)}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.muted}>
              Tap an exercise to pick it up, then tap another position to swap — or use arrows.
            </Text>

            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
              {sessionExercises.map((se, idx) => {
                const isSelected = swapSourceIdx === idx;
                return (
                  <Pressable
                    key={se.id}
                    style={[styles.orderRow, isSelected && styles.orderRowSelected]}
                    onPress={() => {
                      if (swapSourceIdx === null) {
                        setSwapSourceIdx(idx);
                      } else {
                        void handleSwapOrMove(swapSourceIdx, idx);
                      }
                    }}
                  >
                    <Text style={styles.orderRowText}>
                      {idx + 1}. {se.exercise?.name ?? 'Exercise'}
                    </Text>
                    <View style={styles.rowGapSmall}>
                      <Pressable onPress={() => void handleSwapOrMove(idx, idx - 1)}>
                        <ArrowUp size={16} color={Colors.textSecondary} />
                      </Pressable>
                      <Pressable onPress={() => void handleSwapOrMove(idx, idx + 1)}>
                        <ArrowDown size={16} color={Colors.textSecondary} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.rowGap}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Type new exercise name..."
                placeholderTextColor={Colors.textMuted}
                value={newExName}
                onChangeText={setNewExName}
              />
              <Pressable
                style={styles.outlineBtn}
                onPress={async () => {
                  if (!newExName.trim()) return;
                  const added = await addExerciseByName(newExName);
                  if (added) {
                    setAdHocMap((prev) => ({ ...prev, [added.exercise_id]: true }));
                  }
                  setNewExName('');
                }}
              >
                <Plus size={16} color={Colors.primary} />
                <Text style={styles.outlineBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Zero-Rep Reason Modal */}
      <Modal visible={Boolean(pendingZeroSet)} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Why was this set not done?</Text>
              <Pressable onPress={() => setPendingZeroSet(null)}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.muted}>
              0 reps recorded — tap a reason or type your own:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['Cramp', 'Catch / Pull', 'Pain / Discomfort', 'Fatigue', 'Equipment Busy'].map(
                (r) => {
                  const active = zeroReasonInput === r;
                  return (
                    <Pressable
                      key={r}
                      style={[
                        styles.reasonChip,
                        active && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                      ]}
                      onPress={() => setZeroReasonInput(r)}
                    >
                      <Text
                        style={[
                          styles.reasonChipText,
                          active && { color: Colors.primaryText },
                        ]}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Other reason (e.g. shoulder catch)..."
              placeholderTextColor={Colors.textMuted}
              value={zeroReasonInput}
              onChangeText={setZeroReasonInput}
            />
            <Pressable style={styles.primaryBtn} onPress={() => void handleConfirmZeroSet()}>
              <Check size={16} color={Colors.primaryText} />
              <Text style={styles.primaryBtnText}>Save Reason &amp; Log</Text>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayLabel: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  overlayBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overlayBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasonChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  exNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  stepKicker: { color: Colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  exerciseTitle: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  listItem: { color: Colors.textSecondary, fontSize: 14 },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  miniLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rowGapSmall: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: Colors.primaryText, fontSize: 14, fontWeight: '800' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outlineBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkRowActive: {
    borderColor: Colors.success,
    backgroundColor: Colors.successSoft,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  lockedSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.successSoft,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  lockedSetText: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  lockedSetVal: { color: Colors.success, fontSize: 13, fontWeight: '700' },
  activeSetBox: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  sameWeightBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  sameWeightText: { color: Colors.gold, fontSize: 12, fontWeight: '700' },
  timerDisplay: {
    color: Colors.text,
    fontSize: 42,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: 8,
  },
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
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderRowSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSoft,
  },
  orderRowText: { color: Colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  prevBanner: {
    backgroundColor: Colors.goldSoft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    gap: 8,
  },
  prevKicker: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  prevSetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  prevSetChip: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  prevSetChipText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
