import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
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
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Minus,
  Moon,
  Pencil,
  Plus,
  Scale,
  Sparkles,
  X,
} from 'lucide-react-native';
import { DateStrip } from '../../components/DateStrip';
import { PhotoLightboxModal } from '../../components/PhotoLightboxModal';
import { SundayWeeklyReport } from '../../components/SundayWeeklyReport';
import { useAuth } from '../../context/AuthContext';
import {
  formatReadableDate,
  getDayOfWeekFromDate,
  useSelectedDate,
} from '../../context/DateContext';
import { useDailyHabits } from '../../hooks/useDailyHabits';
import { DISCIPLINE_ITEMS, useDailyDiscipline } from '../../hooks/useDailyDiscipline';
import { useDiet } from '../../hooks/useDiet';
import { FULL_DAY_NAMES, useSplit } from '../../hooks/useSplit';
import { useWorkoutSession } from '../../hooks/useWorkoutSession';
import { getOptimizedPhotoUrl } from '../../lib/cloudinary';
import { formatSetDisplay } from '../../lib/workoutFormat';
import { GymAndroidNative } from '../../native/GymAndroidNative';
import { getCachedJson, getTodayDateString, setCachedJson } from '../../lib/storage';
import { Colors } from '../../theme/colors';
import { PoseTag, ProgressPhoto } from '../../types/database';

const POSE_TAGS: PoseTag[] = ['front', 'side', 'back', 'pump'];

function formatTimeHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function TodayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { selectedDate, resetToToday } = useSelectedDate();
  const dayIndex = getDayOfWeekFromDate(selectedDate);
  const { getSplitForDate } = useSplit();
  const { data: todaySplit } = getSplitForDate(selectedDate);

  const {
    dailyTotals,
    goals,
    activeTargetScope,
    foodLogs,
    refresh: refreshDiet,
  } = useDiet();
  const { session, sessionExercises, sets, refresh: refreshWorkout } =
    useWorkoutSession(todaySplit);
  const {
    dailyLog,
    todayPhotos,
    sleepDurationHours,
    uploadingPhoto,
    refresh: refreshHabits,
    adjustWater,
    saveSteps,
    saveWeight,
    saveSleep,
    saveBulkDayHabits,
    addProgressPhoto,
  } = useDailyHabits();

  useFocusEffect(
    useCallback(() => {
      void refreshDiet();
      void refreshWorkout();
      void refreshHabits();
    }, [refreshDiet, refreshHabits, refreshWorkout])
  );
  const { checks: disciplineChecks, toggleCheck: toggleDiscipline } = useDailyDiscipline();

  const [backfillOpen, setBackfillOpen] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<ProgressPhoto | null>(null);
  const [savedDays, setSavedDays] = useState<Record<string, boolean>>({});
  const savedDaysCacheKey = `gym_saved_days_${user.id}_v1`;

  useEffect(() => {
    void (async () => {
      const cached = await getCachedJson<Record<string, boolean>>(savedDaysCacheKey);
      if (cached) setSavedDays(cached);
    })();
  }, [savedDaysCacheKey]);

  const isDaySaved = Boolean(savedDays[selectedDate]);

  const setDaySaved = async (saved: boolean) => {
    const next = { ...savedDays, [selectedDate]: saved };
    setSavedDays(next);
    await setCachedJson(savedDaysCacheKey, next);
  };
  const [backfillWater, setBackfillWater] = useState('');
  const [backfillBed, setBackfillBed] = useState('');
  const [backfillWake, setBackfillWake] = useState('');
  const [backfillTreadmill, setBackfillTreadmill] = useState('');
  const [backfillOther, setBackfillOther] = useState('');
  const [backfillPreW, setBackfillPreW] = useState('');
  const [backfillPostW, setBackfillPostW] = useState('');

  const [drafts, setDrafts] = useState<{
    key: string;
    bed?: string;
    wake?: string;
    treadmill?: string;
    otherSteps?: string;
    preWeight?: string;
    postWeight?: string;
  }>({ key: '' });
  const [poseTag, setPoseTag] = useState<PoseTag>('front');

  const syncKey = `${selectedDate}:${dailyLog?.updated_at ?? 'none'}`;
  const activeDraft = drafts.key === syncKey ? drafts : { key: syncKey };
  const bedInput = activeDraft.bed ?? formatTimeHHMM(dailyLog?.sleep_time);
  const wakeInput = activeDraft.wake ?? formatTimeHHMM(dailyLog?.wake_time);
  const treadmillInput =
    activeDraft.treadmill ?? (dailyLog?.steps_treadmill ? String(dailyLog.steps_treadmill) : '');
  const otherStepsInput =
    activeDraft.otherSteps ?? (dailyLog?.steps_other ? String(dailyLog.steps_other) : '');
  const preWeightInput =
    activeDraft.preWeight ?? (dailyLog?.weight_pre_kg != null ? String(dailyLog.weight_pre_kg) : '');
  const postWeightInput =
    activeDraft.postWeight ?? (dailyLog?.weight_post_kg != null ? String(dailyLog.weight_post_kg) : '');

  const updateDraft = (patch: Partial<Omit<typeof drafts, 'key'>>) => {
    setDrafts((prev) => ({
      ...(prev.key === syncKey ? prev : { key: syncKey }),
      ...patch,
    }));
  };

  useEffect(() => {
    GymAndroidNative.updateWidgetSnapshot({
      remainingCalories: goals.target_calories - dailyTotals.calories,
      remainingProtein: goals.target_protein_g - dailyTotals.protein_g,
      waterGlasses: dailyLog?.water_glasses ?? 0,
      splitName: todaySplit?.split.split_name ?? "Today's Split",
    });
  }, [
    dailyLog?.water_glasses,
    dailyTotals.calories,
    dailyTotals.protein_g,
    goals.target_calories,
    goals.target_protein_g,
    todaySplit?.split.split_name,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void (async () => {
          const pending = await GymAndroidNative.consumePendingLogs();
          if (pending.waterDelta > 0) {
            await adjustWater(pending.waterDelta);
          }
        })();
      }
    });
    return () => sub.remove();
  }, [adjustWater]);

  const handleWater = async (delta: number) => {
    await adjustWater(delta);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveSleep = async () => {
    try {
      await saveSleep(bedInput.trim(), wakeInput.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Sleep & wake time logged.');
    } catch (err) {
      Alert.alert('Format Error', err instanceof Error ? err.message : 'Invalid time.');
    }
  };

  const handleSaveSteps = async () => {
    const t = parseInt(treadmillInput, 10) || 0;
    const o = parseInt(otherStepsInput, 10) || 0;
    await saveSteps(t, o);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', `Total steps updated: ${t + o}`);
  };

  const handleSaveWeight = async () => {
    const pre = preWeightInput.trim() ? parseFloat(preWeightInput) : null;
    const post = postWeightInput.trim() ? parseFloat(postWeightInput) : null;
    if ((pre !== null && Number.isNaN(pre)) || (post !== null && Number.isNaN(post))) {
      Alert.alert('Invalid Weight', 'Enter valid numbers in kg (e.g. 72.5).');
      return;
    }
    await saveWeight(pre, post);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', 'Body weight updated.');
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
      ? await ImagePicker.launchCameraAsync({ quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.75 });

    if (result.canceled || !result.assets[0]) return;

    try {
      await addProgressPhoto(result.assets[0].uri, poseTag);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Cloudinary error.');
    }
  };

  const totalSteps = (dailyLog?.steps_treadmill ?? 0) + (dailyLog?.steps_other ?? 0);
  const isSundayRest = dayIndex === 0 || Boolean(todaySplit?.split.is_rest_day);
  const todayStr = getTodayDateString();
  const isPastDate = selectedDate < todayStr;
  const isFutureDate = selectedDate > todayStr;
  const isLockedFuture = isFutureDate && dayIndex !== 0;
  const hasWeight = dailyLog?.weight_pre_kg != null || dailyLog?.weight_post_kg != null;

  const missingItems: string[] = [];
  if (!session) missingItems.push('Workout');
  if (foodLogs.length === 0) missingItems.push('Calories');
  if ((dailyLog?.water_glasses ?? 0) === 0) missingItems.push('Water');
  if (sleepDurationHours === null) missingItems.push('Sleep');
  if (totalSteps === 0) missingItems.push('Steps');
  if (!hasWeight) missingItems.push('Weight');
  if (todayPhotos.length === 0) missingItems.push('Photo');

  const openBackfillModal = () => {
    setBackfillWater(dailyLog?.water_glasses ? String(dailyLog.water_glasses) : '');
    setBackfillBed(formatTimeHHMM(dailyLog?.sleep_time) || '23:15');
    setBackfillWake(formatTimeHHMM(dailyLog?.wake_time) || '06:45');
    setBackfillTreadmill(dailyLog?.steps_treadmill ? String(dailyLog.steps_treadmill) : '');
    setBackfillOther(dailyLog?.steps_other ? String(dailyLog.steps_other) : '');
    setBackfillPreW(dailyLog?.weight_pre_kg != null ? String(dailyLog.weight_pre_kg) : '');
    setBackfillPostW(dailyLog?.weight_post_kg != null ? String(dailyLog.weight_post_kg) : '');
    setBackfillOpen(true);
  };

  const handleSaveBackfill = async () => {
    try {
      await saveBulkDayHabits({
        waterGlasses: backfillWater.trim() ? parseInt(backfillWater, 10) || 0 : undefined,
        treadmillSteps: backfillTreadmill.trim() ? parseInt(backfillTreadmill, 10) || 0 : undefined,
        otherSteps: backfillOther.trim() ? parseInt(backfillOther, 10) || 0 : undefined,
        preWeightKg: backfillPreW.trim() ? parseFloat(backfillPreW) : undefined,
        postWeightKg: backfillPostW.trim() ? parseFloat(backfillPostW) : undefined,
        bedHHMM: backfillBed.trim() && backfillWake.trim() ? backfillBed.trim() : undefined,
        wakeHHMM: backfillBed.trim() && backfillWake.trim() ? backfillWake.trim() : undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setBackfillOpen(false);
    } catch (err) {
      Alert.alert('Check Input', err instanceof Error ? err.message : 'Invalid values.');
    }
  };

  const handleSaveDay = async () => {
    try {
      const hasAnyDraft =
        activeDraft.treadmill !== undefined ||
        activeDraft.otherSteps !== undefined ||
        activeDraft.preWeight !== undefined ||
        activeDraft.postWeight !== undefined ||
        (activeDraft.bed !== undefined && activeDraft.wake !== undefined);

      if (hasAnyDraft) {
        await saveBulkDayHabits({
          treadmillSteps:
            activeDraft.treadmill !== undefined ? parseInt(treadmillInput, 10) || 0 : undefined,
          otherSteps:
            activeDraft.otherSteps !== undefined ? parseInt(otherStepsInput, 10) || 0 : undefined,
          preWeightKg:
            activeDraft.preWeight !== undefined
              ? preWeightInput.trim()
                ? parseFloat(preWeightInput)
                : null
              : undefined,
          postWeightKg:
            activeDraft.postWeight !== undefined
              ? postWeightInput.trim()
                ? parseFloat(postWeightInput)
                : null
              : undefined,
          bedHHMM: bedInput.trim() && wakeInput.trim() ? bedInput.trim() : undefined,
          wakeHHMM: bedInput.trim() && wakeInput.trim() ? wakeInput.trim() : undefined,
        });
      }
      await setDaySaved(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Check Input', err instanceof Error ? err.message : 'Could not save day.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>SRAJAN&apos;S • {FULL_DAY_NAMES[dayIndex]}</Text>
          <View style={styles.rowGapSmall}>
            <Text style={styles.title}>{formatReadableDate(selectedDate)}</Text>
            {isDaySaved && <CheckCircle2 size={20} color={Colors.success} />}
          </View>
          <Text style={styles.sub}>{user.phone_number}</Text>
        </View>
        {!isLockedFuture &&
          (isDaySaved ? (
            <Pressable style={styles.editDayBtn} onPress={() => void setDaySaved(false)}>
              <Pencil size={15} color={Colors.gold} />
              <Text style={styles.editDayBtnText}>Edit</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.saveDayHeaderBtn} onPress={() => void handleSaveDay()}>
              <CheckCircle2 size={15} color={Colors.primaryText} />
              <Text style={styles.saveDayHeaderBtnText}>Save Day</Text>
            </Pressable>
          ))}
      </View>

      <DateStrip />

      {isLockedFuture ? (
        <View style={styles.futureCard}>
          <Text style={styles.futureEmoji}>💪</Text>
          <Text style={styles.futureTitle}>Phle aaj ka workout krle!</Text>
          <Text style={styles.futureSub}>
            {formatReadableDate(selectedDate)} is still in the future. Focus on today&apos;s workout
            and targets first.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={resetToToday}>
            <Text style={styles.btnText}>Go to Today</Text>
          </Pressable>
        </View>
      ) : isDaySaved ? (
        <View style={styles.summaryWrap}>
          {dayIndex === 0 && (
            <SundayWeeklyReport
              sundayDate={selectedDate}
              targetCalories={goals.target_calories}
              targetProteinG={goals.target_protein_g}
            />
          )}
          {/* Workout Summary */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.rowGapSmall}>
                <View style={[styles.iconBadge, { backgroundColor: Colors.primarySoft }]}>
                  <Dumbbell size={15} color={Colors.primary} />
                </View>
                <Text style={styles.cardTitle}>Workout</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      session?.status === 'completed'
                        ? Colors.successSoft
                        : session
                          ? Colors.amberSoft
                          : Colors.surfaceElevated,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color:
                        session?.status === 'completed'
                          ? Colors.success
                          : session
                            ? Colors.amber
                            : Colors.textMuted,
                    },
                  ]}
                >
                  {session?.status === 'completed'
                    ? 'Completed'
                    : session
                      ? 'In Progress'
                      : 'Not logged'}
                </Text>
              </View>
            </View>
            <Text style={styles.splitName}>
              {session?.split_name ?? todaySplit?.split.split_name ?? 'Rest / No split'}
            </Text>
            {session ? (
              <View style={styles.workoutMetaWrap}>
                <Text style={styles.muted}>
                  {sessionExercises.length} exercises • {sets.length} sets
                  {dailyLog?.weight_post_kg != null ? ` • Post Weight: ${dailyLog.weight_post_kg} kg` : ''}
                  {dailyLog?.weight_pre_kg != null ? ` • Pre Weight: ${dailyLog.weight_pre_kg} kg` : ''}
                </Text>
                <View style={styles.exerciseGrid}>
                  {sessionExercises.map((se) => {
                    const exSets = sets.filter((s) => s.exercise_id === se.exercise_id);
                    return (
                      <View key={se.id} style={styles.exerciseGridTile}>
                        <Text style={styles.exerciseGridTitle} numberOfLines={2}>
                          {se.exercise?.name ?? 'Exercise'}
                        </Text>
                        <View style={styles.exerciseGridRows}>
                          {exSets.length === 0 ? (
                            <Text style={styles.tileHint}>0 sets</Text>
                          ) : (
                            exSets.map((s, idx) => (
                              <View key={s.id} style={styles.exerciseGridRow}>
                                <Text style={styles.gridSetNum}>S{idx + 1}</Text>
                                <Text style={styles.gridSetVal}>
                                  {formatSetDisplay(
                                    se.exercise?.name,
                                    Number(s.weight_kg),
                                    s.reps
                                  )}
                                </Text>
                              </View>
                            ))
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>No workout logged for this day.</Text>
            )}
          </View>

          {/* Meals & Calories Summary */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.rowGapSmall}>
                <View style={[styles.iconBadge, { backgroundColor: Colors.amberSoft }]}>
                  <Flame size={15} color={Colors.amber} />
                </View>
                <Text style={styles.cardTitle}>Meals &amp; Calories</Text>
              </View>
              <Text style={[styles.badge, { color: Colors.primary }]}>
                {dailyTotals.calories} / {goals.target_calories} kcal
              </Text>
            </View>

            <View style={styles.calBarBg}>
              <View
                style={[
                  styles.calBarFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.round((dailyTotals.calories / Math.max(1, goals.target_calories)) * 100)
                    )}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.macroPillRow}>
              <View style={[styles.macroPill, { backgroundColor: Colors.successSoft }]}>
                <Text style={[styles.macroPillText, { color: Colors.success }]}>
                  P {dailyTotals.protein_g}g
                </Text>
              </View>
              <View style={[styles.macroPill, { backgroundColor: Colors.amberSoft }]}>
                <Text style={[styles.macroPillText, { color: Colors.amber }]}>
                  C {dailyTotals.carbs_g}g
                </Text>
              </View>
              <View style={[styles.macroPill, { backgroundColor: Colors.purpleSoft }]}>
                <Text style={[styles.macroPillText, { color: Colors.purple }]}>
                  F {dailyTotals.fat_g}g
                </Text>
              </View>
            </View>

            {foodLogs.length > 0 ? (
              <View style={styles.mealListWrap}>
                {foodLogs.map((log) => (
                  <View key={log.id} style={styles.mealSummaryRow}>
                    <Text style={styles.mealSummaryName} numberOfLines={1}>
                      {log.meal_name}
                    </Text>
                    <Text style={styles.mealSummaryKcal}>{Math.round(log.calories)} kcal</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.notSetHint}>No meals logged for this day.</Text>
            )}
          </View>

          {/* Habits 2x2 Grid: Water, Sleep & Wake, Steps, Weight */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <View style={styles.rowBetween}>
                <View style={styles.rowGapSmall}>
                  <Droplets size={15} color={Colors.primary} />
                  <Text style={styles.tileLabel}>Water</Text>
                </View>
                <Pressable
                  style={styles.tilePlusBtn}
                  onPress={() => void handleWater(1)}
                >
                  <Plus size={14} color={Colors.primary} />
                </Pressable>
              </View>
              <Text style={styles.tileValue}>
                {dailyLog?.water_glasses ? `${dailyLog.water_glasses} glasses` : '0 glasses'}
              </Text>
            </View>

            <View style={styles.summaryTile}>
              <View style={styles.rowGapSmall}>
                <Moon size={15} color={Colors.purple} />
                <Text style={styles.tileLabel}>Sleep & Wake</Text>
              </View>
              <Text style={styles.tileValue}>
                {sleepDurationHours !== null ? `${sleepDurationHours} hrs` : 'Not logged'}
              </Text>
              {dailyLog?.sleep_time && dailyLog?.wake_time && (
                <Text style={styles.tileHint}>
                  {formatTimeHHMM(dailyLog.sleep_time)} → {formatTimeHHMM(dailyLog.wake_time)}
                </Text>
              )}
            </View>

            <View style={styles.summaryTile}>
              <View style={styles.rowGapSmall}>
                <Footprints size={15} color={Colors.success} />
                <Text style={styles.tileLabel}>Steps</Text>
              </View>
              <Text style={styles.tileValue}>
                {totalSteps > 0 ? `${totalSteps.toLocaleString()} steps` : 'Not logged'}
              </Text>
              {totalSteps > 0 && (
                <Text style={styles.tileHint}>
                  Treadmill {dailyLog?.steps_treadmill ?? 0} • Other {dailyLog?.steps_other ?? 0}
                </Text>
              )}
              {Boolean(dailyLog?.notes) && (
                <Text style={styles.tileHint}>{dailyLog?.notes}</Text>
              )}
            </View>

            <View style={styles.summaryTile}>
              <View style={styles.rowGapSmall}>
                <Scale size={15} color={Colors.gold} />
                <Text style={styles.tileLabel}>Weight</Text>
              </View>
              <Text style={styles.tileValue}>
                {dailyLog?.weight_post_kg != null
                  ? `${dailyLog.weight_post_kg} kg`
                  : dailyLog?.weight_pre_kg != null
                    ? `${dailyLog.weight_pre_kg} kg`
                    : 'Not logged'}
              </Text>
              {dailyLog?.weight_pre_kg != null && dailyLog?.weight_post_kg != null && (
                <Text style={styles.tileHint}>
                  Pre {dailyLog.weight_pre_kg} • Post {dailyLog.weight_post_kg}
                </Text>
              )}
            </View>
          </View>

          {/* Daily Discipline Summary */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Daily Discipline</Text>
              <Text style={[styles.badge, { color: Colors.success }]}>
                {DISCIPLINE_ITEMS.filter((i) => disciplineChecks[i.key]).length} /{' '}
                {DISCIPLINE_ITEMS.length}
              </Text>
            </View>
            <View style={styles.disciplineGrid}>
              {DISCIPLINE_ITEMS.map((item) => {
                const checked = Boolean(disciplineChecks[item.key]);
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.disciplineChip, checked && styles.disciplineChipActive]}
                    onPress={() => void toggleDiscipline(item.key)}
                  >
                    <View style={[styles.smallCheck, checked && styles.smallCheckActive]}>
                      {checked && <Check size={11} color={Colors.primaryText} />}
                    </View>
                    <Text
                      style={[
                        styles.disciplineLabel,
                        checked && styles.disciplineLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Progress Photos Summary */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.rowGapSmall}>
                <Camera size={17} color={Colors.amber} />
                <Text style={styles.cardTitle}>Progress Photos</Text>
              </View>
              {uploadingPhoto && <ActivityIndicator size="small" color={Colors.amber} />}
            </View>
            {todayPhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {todayPhotos.map((p) => (
                  <Pressable key={p.id} style={styles.thumbWrap} onPress={() => setEnlargedPhoto(p)}>
                    <Image
                      source={{ uri: getOptimizedPhotoUrl(p.cloudinary_url, 400) }}
                      style={styles.thumb}
                    />
                    <Text style={styles.thumbTag}>{p.pose_tag}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <>
                <Text style={styles.notSetHint}>No progress photo for this day yet.</Text>
                <View style={styles.rowGap}>
                  {POSE_TAGS.map((tag) => (
                    <Pressable
                      key={tag}
                      style={[styles.poseChip, poseTag === tag && styles.poseChipActive]}
                      onPress={() => setPoseTag(tag)}
                    >
                      <Text style={[styles.poseText, poseTag === tag && styles.poseTextActive]}>
                        {tag}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.rowGap}>
                  <Pressable
                    style={[styles.outlineBtn, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => handlePickPhoto(true)}
                    disabled={uploadingPhoto}
                  >
                    <Camera size={16} color={Colors.primary} />
                    <Text style={styles.outlineText}>Take Photo</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.outlineBtn, { flex: 1, justifyContent: 'center' }]}
                    onPress={() => handlePickPhoto(false)}
                    disabled={uploadingPhoto}
                  >
                    <Text style={styles.outlineText}>Gallery</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          {dayIndex === 0 && (
            <SundayWeeklyReport
              sundayDate={selectedDate}
              targetCalories={goals.target_calories}
              targetProteinG={goals.target_protein_g}
            />
          )}
          {isPastDate && (
        <View style={styles.pastBanner}>
          <View style={styles.rowBetween}>
            <View style={styles.rowGapSmall}>
              <Sparkles size={16} color={Colors.amber} />
              <Text style={styles.pastKicker}>
                PAST DATE LOG • {formatReadableDate(selectedDate).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.pastTitle}>
            {missingItems.length > 0
              ? `Fill in data for ${formatReadableDate(selectedDate)}`
              : `All data logged for ${formatReadableDate(selectedDate)}`}
          </Text>
          <Text style={styles.pastSub}>
            {missingItems.length > 0
              ? `Missing: ${missingItems.join(' • ')}`
              : 'You can still edit any section below.'}
          </Text>
          <Pressable style={styles.pastFillBtn} onPress={openBackfillModal}>
            <Text style={styles.pastFillBtnText}>
              {missingItems.length > 0 ? 'Fill Missing Habits' : 'Edit Day Habits'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Workout Summary for Selected Date */}
      <View style={[styles.card, isPastDate && !session && styles.pastMissingCard]}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Workout</Text>
          <Text
            style={[
              styles.badge,
              {
                color:
                  session?.status === 'completed'
                    ? Colors.success
                    : session
                      ? Colors.amber
                      : Colors.textMuted,
              },
            ]}
          >
            {session?.status === 'completed'
              ? 'Completed'
              : session
                ? 'In Progress'
                : 'Not logged'}
          </Text>
        </View>
        <Text style={styles.splitName}>
          {session?.split_name ?? todaySplit?.split.split_name ?? 'No split set for this day'}
        </Text>
        {session ? (
          <View style={styles.workoutMetaWrap}>
            <Text style={styles.muted}>
              {sessionExercises.length} exercises • {sets.length} sets logged
              {dailyLog?.weight_post_kg != null ? ` • Post: ${dailyLog.weight_post_kg} kg` : ''}
            </Text>
            <View style={styles.exerciseGrid}>
              {sessionExercises.slice(0, 4).map((se) => {
                const exSets = sets.filter((s) => s.exercise_id === se.exercise_id);
                return (
                  <View key={se.id} style={styles.exerciseGridTile}>
                    <Text style={styles.exerciseGridTitle} numberOfLines={2}>
                      {se.exercise?.name ?? 'Exercise'}
                    </Text>
                    <View style={styles.exerciseGridRows}>
                      {exSets.length === 0 ? (
                        <Text style={styles.tileHint}>0 sets</Text>
                      ) : (
                        exSets.map((s, idx) => (
                          <View key={s.id} style={styles.exerciseGridRow}>
                            <Text style={styles.gridSetNum}>S{idx + 1}</Text>
                            <Text style={styles.gridSetVal}>
                              {formatSetDisplay(
                                se.exercise?.name,
                                Number(s.weight_kg),
                                s.reps
                              )}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
            {sessionExercises.length > 4 && (
              <Text style={styles.muted}>+{sessionExercises.length - 4} more exercises</Text>
            )}
          </View>
        ) : isSundayRest ? (
          <Text style={styles.muted}>
            Sunday Rest Day — recover today and plan next week&apos;s workout split &amp; calorie targets.
          </Text>
        ) : (
          <Text style={styles.muted}>No workout recorded for this day yet.</Text>
        )}
        <View style={styles.rowGap}>
          {isSundayRest ? (
            <>
              <Pressable
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={() => router.push('/split-planner')}
              >
                <Calendar size={16} color={Colors.primaryText} />
                <Text style={styles.btnText}>Plan Next Week Split</Text>
              </Pressable>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => router.push('/(tabs)/diet')}
              >
                <Text style={styles.outlineText}>Set Targets</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.primaryBtn, { flex: 1 }]}
                onPress={() => router.push('/(tabs)/workout')}
              >
                <Dumbbell size={16} color={Colors.primaryText} />
                <Text style={styles.btnText}>
                  {!session || sets.length === 0 ? 'Start Workout' : 'Continue / Edit Workout'}
                </Text>
              </Pressable>
              <Pressable style={styles.outlineBtn} onPress={() => router.push('/split-planner')}>
                <Calendar size={16} color={Colors.primary} />
                <Text style={styles.outlineText}>Plan Split</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Diet Snapshot */}
      <Pressable
        style={[styles.card, isPastDate && foodLogs.length === 0 && styles.pastMissingCard]}
        onPress={() => router.push('/(tabs)/diet')}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Calories & Nutrition</Text>
          <Text style={styles.linkText}>
            {foodLogs.length > 0 ? 'Edit Diet →' : 'Log Meals →'}
          </Text>
        </View>
        <Text style={styles.bigVal}>
          {dailyTotals.calories} / {goals.target_calories} kcal
        </Text>
        <Text style={styles.muted}>
          {activeTargetScope.toUpperCase()} target • Protein: {dailyTotals.protein_g} /{' '}
          {goals.target_protein_g}g • Carbs: {dailyTotals.carbs_g}g • Fat: {dailyTotals.fat_g}g
        </Text>
        {foodLogs.length > 0 ? (
          <View style={styles.mealListWrap}>
            {foodLogs.map((log) => (
              <View key={log.id} style={styles.mealSummaryRow}>
                <Text style={styles.mealSummaryName} numberOfLines={1}>
                  {log.meal_name}
                </Text>
                <Text style={styles.mealSummaryKcal}>{Math.round(log.calories)} kcal</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.notSetHint}>No meals logged for this day. Tap to add or set target.</Text>
        )}
      </Pressable>

      {/* Water Intake */}
      <View
        style={[
          styles.card,
          isPastDate && (dailyLog?.water_glasses ?? 0) === 0 && styles.pastMissingCard,
        ]}
      >
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Droplets size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>Water Intake</Text>
          </View>
          <Text style={styles.bigVal}>
            {dailyLog?.water_glasses ? `${dailyLog.water_glasses} glasses` : '0 glasses (Not set)'}
          </Text>
        </View>
        <View style={styles.rowGap}>
          <Pressable style={styles.waterBtn} onPress={() => handleWater(-1)}>
            <Minus size={16} color={Colors.text} />
            <Text style={styles.waterBtnText}>-1 Glass</Text>
          </Pressable>
          <Pressable
            style={[styles.waterBtn, { backgroundColor: Colors.primarySoft, borderColor: Colors.primary }]}
            onPress={() => handleWater(1)}
          >
            <Plus size={16} color={Colors.primary} />
            <Text style={[styles.waterBtnText, { color: Colors.primary }]}>+1 Glass</Text>
          </Pressable>
        </View>
      </View>

      {/* Sleep & Wake Time */}
      <View style={[styles.card, isPastDate && sleepDurationHours === null && styles.pastMissingCard]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Moon size={18} color={Colors.purple} />
            <Text style={styles.cardTitle}>Sleep & Wake Time</Text>
          </View>
          {sleepDurationHours !== null ? (
            <Text style={[styles.badge, { color: Colors.purple }]}>{sleepDurationHours} hrs</Text>
          ) : (
            <Text style={[styles.badge, { color: Colors.textMuted }]}>Not set</Text>
          )}
        </View>
        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Bed (24h HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={bedInput}
              onChangeText={(v) => updateDraft({ bed: v })}
              placeholder="23:15"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Wake (24h HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={wakeInput}
              onChangeText={(v) => updateDraft({ wake: v })}
              placeholder="06:45"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <Pressable style={styles.saveSmallBtn} onPress={handleSaveSleep}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        </View>
      </View>

      {/* Treadmill & General Steps */}
      <View style={[styles.card, isPastDate && totalSteps === 0 && styles.pastMissingCard]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Footprints size={18} color={Colors.success} />
            <Text style={styles.cardTitle}>Steps Tracker</Text>
          </View>
          <Text style={[styles.badge, { color: totalSteps > 0 ? Colors.success : Colors.textMuted }]}>
            {totalSteps > 0 ? `${totalSteps} total` : 'Not set'}
          </Text>
        </View>
        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>
              Treadmill ({dailyLog?.steps_treadmill ?? 0})
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={treadmillInput}
              onChangeText={(v) => updateDraft({ treadmill: v })}
              placeholder="e.g. 4000"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Other ({dailyLog?.steps_other ?? 0})</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={otherStepsInput}
              onChangeText={(v) => updateDraft({ otherSteps: v })}
              placeholder="e.g. 5500"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <Pressable style={styles.saveSmallBtn} onPress={handleSaveSteps}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        </View>
        {Boolean(dailyLog?.notes) && <Text style={styles.muted}>{dailyLog?.notes}</Text>}
      </View>

      {/* Body Weight */}
      <View style={[styles.card, isPastDate && !hasWeight && styles.pastMissingCard]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Scale size={18} color={Colors.gold} />
            <Text style={styles.cardTitle}>Body Weight (kg)</Text>
          </View>
          <Text
            style={[
              styles.badge,
              {
                color:
                  dailyLog?.weight_pre_kg != null || dailyLog?.weight_post_kg != null
                    ? Colors.gold
                    : Colors.textMuted,
              },
            ]}
          >
            {dailyLog?.weight_pre_kg != null
              ? `${dailyLog.weight_pre_kg} kg`
              : dailyLog?.weight_post_kg != null
                ? `${dailyLog.weight_post_kg} kg`
                : 'Not set'}
          </Text>
        </View>
        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Pre-Workout</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={preWeightInput}
              onChangeText={(v) => updateDraft({ preWeight: v })}
              placeholder="e.g. 72.5"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Post-Workout</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={postWeightInput}
              onChangeText={(v) => updateDraft({ postWeight: v })}
              placeholder="e.g. 72.0"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <Pressable style={styles.saveSmallBtn} onPress={handleSaveWeight}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        </View>
      </View>

      {/* Daily Discipline Checkboxes */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Daily Discipline</Text>
          <Text style={[styles.badge, { color: Colors.success }]}>
            {DISCIPLINE_ITEMS.filter((i) => disciplineChecks[i.key]).length} /{' '}
            {DISCIPLINE_ITEMS.length}
          </Text>
        </View>
        <View style={styles.disciplineGrid}>
          {DISCIPLINE_ITEMS.map((item) => {
            const checked = Boolean(disciplineChecks[item.key]);
            return (
              <Pressable
                key={item.key}
                style={[styles.disciplineChip, checked && styles.disciplineChipActive]}
                onPress={() => void toggleDiscipline(item.key)}
              >
                <View style={[styles.smallCheck, checked && styles.smallCheckActive]}>
                  {checked && <Check size={11} color={Colors.primaryText} />}
                </View>
                <Text
                  style={[styles.disciplineLabel, checked && styles.disciplineLabelActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Daily Progress Photo (Cloudinary) */}
      <View style={[styles.card, isPastDate && todayPhotos.length === 0 && styles.pastMissingCard]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Camera size={18} color={Colors.amber} />
            <Text style={styles.cardTitle}>Daily Progress Photo</Text>
          </View>
          {uploadingPhoto && <ActivityIndicator size="small" color={Colors.amber} />}
        </View>

        <View style={styles.rowGap}>
          {POSE_TAGS.map((tag) => (
            <Pressable
              key={tag}
              style={[styles.poseChip, poseTag === tag && styles.poseChipActive]}
              onPress={() => setPoseTag(tag)}
            >
              <Text style={[styles.poseText, poseTag === tag && styles.poseTextActive]}>
                {tag}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rowGap}>
          <Pressable
            style={[styles.outlineBtn, { flex: 1, justifyContent: 'center' }]}
            onPress={() => handlePickPhoto(true)}
            disabled={uploadingPhoto}
          >
            <Camera size={16} color={Colors.primary} />
            <Text style={styles.outlineText}>Take Photo</Text>
          </Pressable>
          <Pressable
            style={[styles.outlineBtn, { flex: 1, justifyContent: 'center' }]}
            onPress={() => handlePickPhoto(false)}
            disabled={uploadingPhoto}
          >
            <Text style={styles.outlineText}>Gallery</Text>
          </Pressable>
        </View>

        {todayPhotos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {todayPhotos.map((p) => (
              <Pressable key={p.id} style={styles.thumbWrap} onPress={() => setEnlargedPhoto(p)}>
                <Image
                  source={{ uri: getOptimizedPhotoUrl(p.cloudinary_url, 400) }}
                  style={styles.thumb}
                />
                <Text style={styles.thumbTag}>{p.pose_tag}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.notSetHint}>No progress photo logged for this day yet.</Text>
        )}
      </View>

          <Pressable style={styles.saveDayFooterBtn} onPress={() => void handleSaveDay()}>
            <CheckCircle2 size={18} color={Colors.primaryText} />
            <Text style={styles.btnText}>Save {formatReadableDate(selectedDate)}</Text>
          </Pressable>
        </>
      )}

      <Modal visible={backfillOpen} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>
                Fill Data • {formatReadableDate(selectedDate)}
              </Text>
              <Pressable onPress={() => setBackfillOpen(false)}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.muted}>
              Enter any missing details for {selectedDate} below:
            </Text>

            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Water (glasses)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={backfillWater}
                  onChangeText={setBackfillWater}
                  placeholder="e.g. 8"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Pre Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={backfillPreW}
                  onChangeText={setBackfillPreW}
                  placeholder="e.g. 72.5"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Post Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={backfillPostW}
                  onChangeText={setBackfillPostW}
                  placeholder="e.g. 72.0"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Bed Time (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={backfillBed}
                  onChangeText={setBackfillBed}
                  placeholder="23:15"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Wake Time (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={backfillWake}
                  onChangeText={setBackfillWake}
                  placeholder="06:45"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Treadmill Steps</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={backfillTreadmill}
                  onChangeText={setBackfillTreadmill}
                  placeholder="e.g. 4000"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniLabel}>Other Steps</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={backfillOther}
                  onChangeText={setBackfillOther}
                  placeholder="e.g. 5500"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <Pressable style={styles.primaryBtn} onPress={handleSaveBackfill}>
              <Text style={styles.btnText}>Save All for {formatReadableDate(selectedDate)}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PhotoLightboxModal photo={enlargedPhoto} onClose={() => setEnlargedPhoto(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: Colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  sub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  signOutBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    shadowColor: '#1A1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  calBarBg: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
  },
  calBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  macroPillRow: { flexDirection: 'row', gap: 8 },
  macroPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  macroPillText: { fontSize: 12, fontWeight: '700' },
  mealListWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 8,
    gap: 6,
  },
  mealSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  mealSummaryName: { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 1 },
  mealSummaryKcal: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  splitName: { color: Colors.text, fontSize: 19, fontWeight: '700' },
  bigVal: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  badge: { fontSize: 13, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  linkText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: { color: Colors.primaryText, fontWeight: '700', fontSize: 14 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outlineText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  waterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  waterBtnText: { color: Colors.text, fontWeight: '600', fontSize: 13 },
  miniLabel: { color: Colors.textSecondary, fontSize: 11, marginBottom: 4 },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  saveSmallBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  poseChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  poseChipActive: { backgroundColor: Colors.amberSoft, borderColor: Colors.amber },
  poseText: { color: Colors.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  poseTextActive: { color: Colors.amber, fontWeight: '700' },
  thumbWrap: { alignItems: 'center', gap: 4 },
  thumb: { width: 84, height: 110, borderRadius: 10, backgroundColor: Colors.bg },
  thumbTag: { color: Colors.textSecondary, fontSize: 11, textTransform: 'capitalize' },
  workoutMetaWrap: { gap: 4 },
  workoutExItem: { color: Colors.textSecondary, fontSize: 12 },
  notSetHint: { color: Colors.textMuted, fontSize: 12 },
  pastBanner: {
    backgroundColor: Colors.amberSoft,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.amber,
    gap: 8,
  },
  pastKicker: {
    color: Colors.amber,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  pastTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  pastSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  pastFillBtn: {
    marginTop: 4,
    backgroundColor: Colors.amber,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  pastFillBtnText: { color: '#111111', fontWeight: '800', fontSize: 13 },
  pastMissingCard: {
    borderColor: Colors.amber,
    borderStyle: 'dashed',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveDayHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  saveDayHeaderBtnText: { color: Colors.primaryText, fontSize: 13, fontWeight: '700' },
  editDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  editDayBtnText: { color: Colors.gold, fontSize: 13, fontWeight: '700' },
  saveDayFooterBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  summaryWrap: { gap: 14 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryTile: {
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    shadowColor: '#1A1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  tileLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tilePlusBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  tileHint: { color: Colors.textMuted, fontSize: 11 },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  exerciseGridTile: {
    width: '48.5%',
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 6,
  },
  exerciseGridTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseGridRows: {
    gap: 3,
  },
  exerciseGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridSetNum: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  gridSetVal: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  futureCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  futureEmoji: { fontSize: 36 },
  futureTitle: { color: Colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  futureSub: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  disciplineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  disciplineChip: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disciplineChipActive: {
    backgroundColor: Colors.successSoft,
    borderColor: Colors.success,
  },
  smallCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCheckActive: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  disciplineLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  disciplineLabelActive: {
    color: Colors.text,
    fontWeight: '700',
  },
});
