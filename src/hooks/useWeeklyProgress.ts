import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addDays } from '../context/DateContext';
import { getWeekKey } from './useDiet';
import {
  DailyDisciplineMap,
  DISCIPLINE_ITEMS,
  DisciplineKey,
} from './useDailyDiscipline';
import { getCachedJson, getTodayDateString } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { MuscleGroup, ProgressPhoto } from '../types/database';

export interface WeeklyCheckinSummary {
  avgWeightKg: number | null;
  weightDeltaKg: number | null;
  avgCalories: number;
  avgProteinG: number;
  avgSleepHours: number | null;
  avgSteps: number;
  workoutsCompleted: number;
  totalSets: number;
}

export interface MuscleExerciseDayLog {
  date: string;
  dayLabel: string;
  sets: { weight_kg: number; reps: number }[];
}

export interface MuscleExerciseDetail {
  exerciseId: string;
  exerciseName: string;
  totalSets: number;
  byDay: MuscleExerciseDayLog[];
}

export interface MuscleVolumeItem {
  muscle: MuscleGroup;
  sets: number;
  exercises: MuscleExerciseDetail[];
}

export interface WeekDayExcelRow {
  date: string;
  dayShort: string;
  dateLabel: string;
  workoutName: string;
  workoutStatus: 'completed' | 'in_progress' | 'none';
  setsCount: number;
  calories: number;
  proteinG: number;
  waterGlasses: number;
  steps: number;
  weightKg: number | null;
  disciplineDone: number;
}

export interface WeeklyGamification {
  overallPct: number;
  workoutPct: number;
  caloriePct: number;
  hydrationPct: number;
  disciplinePct: number;
  rank: 'S-TIER' | 'A-TIER' | 'B-TIER' | 'GRINDING';
}

function formatShortDateLabel(dateStr: string): { dayShort: string; dateLabel: string } {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return {
    dayShort: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    dateLabel: dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
}

export function useWeeklyProgress(
  weekOffset = 0,
  targetCalories = 1850,
  targetWater = 10
) {
  const { user } = useAuth();
  const todayStr = getTodayDateString();
  const currentMonday = getWeekKey(todayStr);
  const weekStart = addDays(currentMonday, weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const prevWeekStart = addDays(weekStart, -7);

  const [summary, setSummary] = useState<WeeklyCheckinSummary>({
    avgWeightKg: null,
    weightDeltaKg: null,
    avgCalories: 0,
    avgProteinG: 0,
    avgSleepHours: null,
    avgSteps: 0,
    workoutsCompleted: 0,
    totalSets: 0,
  });
  const [dayRows, setDayRows] = useState<WeekDayExcelRow[]>([]);
  const [muscleVolume, setMuscleVolume] = useState<MuscleVolumeItem[]>([]);
  const [gamification, setGamification] = useState<WeeklyGamification>({
    overallPct: 0,
    workoutPct: 0,
    caloriePct: 0,
    hydrationPct: 0,
    disciplinePct: 0,
    rank: 'GRINDING',
  });
  const [disciplineCounts, setDisciplineCounts] = useState<Record<DisciplineKey, number>>({
    no_porn: 0,
    no_alcohol: 0,
    no_junk: 0,
    no_smoking: 0,
    creatine: 0,
    stretching: 0,
  });
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProgress = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

      const [
        { data: dailyRows },
        { data: foodRows },
        { data: sessionRows },
        { data: photoRows },
        disciplineMaps,
      ] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('log_date', prevWeekStart)
          .lte('log_date', weekEnd)
          .order('log_date', { ascending: true }),
        supabase
          .from('food_logs')
          .select('log_date, calories, protein_g')
          .eq('user_id', user.id)
          .gte('log_date', weekStart)
          .lte('log_date', weekEnd),
        supabase
          .from('workout_sessions')
          .select('id, status, log_date, split_name')
          .eq('user_id', user.id)
          .gte('log_date', weekStart)
          .lte('log_date', weekEnd),
        supabase
          .from('progress_photos')
          .select('*')
          .eq('user_id', user.id)
          .order('log_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(30),
        Promise.all(
          weekDates.map((d) =>
            getCachedJson<DailyDisciplineMap>(`gym_discipline_${user.id}_${d}_v1`)
          )
        ),
      ]);

      const thisWeekDaily = (dailyRows ?? []).filter((r) => r.log_date >= weekStart);
      const prevWeekDaily = (dailyRows ?? []).filter((r) => r.log_date < weekStart);

      const getAvgWeight = (rows: typeof thisWeekDaily) => {
        const weights = rows
          .map((r) => r.weight_post_kg ?? r.weight_pre_kg)
          .filter((w): w is number => w !== null && w !== undefined)
          .map(Number);
        if (weights.length === 0) return null;
        return Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 100) / 100;
      };

      const avgWeightKg = getAvgWeight(thisWeekDaily);
      const prevAvgWeight = getAvgWeight(prevWeekDaily);
      const weightDeltaKg =
        avgWeightKg !== null && prevAvgWeight !== null
          ? Math.round((avgWeightKg - prevAvgWeight) * 100) / 100
          : null;

      const sleepHoursList = thisWeekDaily
        .map((r) => {
          if (!r.sleep_time || !r.wake_time) return null;
          const diff =
            (new Date(r.wake_time).getTime() - new Date(r.sleep_time).getTime()) /
            (1000 * 60 * 60);
          return diff > 0 ? diff : null;
        })
        .filter((h): h is number => h !== null);

      const avgSleepHours =
        sleepHoursList.length > 0
          ? Math.round((sleepHoursList.reduce((a, b) => a + b, 0) / sleepHoursList.length) * 10) /
            10
          : null;

      const stepsTotals = thisWeekDaily
        .map((r) => (r.steps_treadmill ?? 0) + (r.steps_other ?? 0))
        .filter((s) => s > 0);
      const avgSteps =
        stepsTotals.length > 0
          ? Math.round(stepsTotals.reduce((a, b) => a + b, 0) / stepsTotals.length)
          : 0;

      // Food per day
      const foodByDay: Record<string, { cal: number; pro: number }> = {};
      for (const f of foodRows ?? []) {
        if (!foodByDay[f.log_date]) foodByDay[f.log_date] = { cal: 0, pro: 0 };
        foodByDay[f.log_date].cal += Number(f.calories);
        foodByDay[f.log_date].pro += Number(f.protein_g);
      }
      const foodDays = Object.values(foodByDay);
      const avgCalories =
        foodDays.length > 0
          ? Math.round(foodDays.reduce((a, b) => a + b.cal, 0) / foodDays.length)
          : 0;
      const avgProteinG =
        foodDays.length > 0
          ? Math.round(foodDays.reduce((a, b) => a + b.pro, 0) / foodDays.length)
          : 0;

      // Sessions & sets + muscle drilldown
      const sessionById = new Map((sessionRows ?? []).map((s) => [s.id, s]));
      const sessionByDate = new Map((sessionRows ?? []).map((s) => [s.log_date, s]));
      const sessionIds = (sessionRows ?? []).map((s) => s.id);
      const workoutsCompleted = (sessionRows ?? []).filter(
        (s) => s.status === 'completed'
      ).length;

      const setsCountByDate: Record<string, number> = {};
      let totalSets = 0;

      if (sessionIds.length > 0) {
        const { data: setRows } = await supabase
          .from('workout_sets')
          .select('session_id, exercise_id, set_number, weight_kg, reps, set_type, exercise:exercises(id, name, primary_muscle)')
          .in('session_id', sessionIds)
          .neq('set_type', 'warmup')
          .order('set_number', { ascending: true });

        const muscleMap = new Map<
          MuscleGroup,
          {
            sets: number;
            exercises: Map<
              string,
              {
                exerciseName: string;
                totalSets: number;
                byDate: Map<string, { weight_kg: number; reps: number }[]>;
              }
            >;
          }
        >();

        for (const row of setRows ?? []) {
          const isCompletedSet = Number(row.reps) > 0;
          if (isCompletedSet) {
            totalSets += 1;
          }
          const sess = sessionById.get(row.session_id);
          const logDate = sess?.log_date ?? weekStart;
          if (isCompletedSet) {
            setsCountByDate[logDate] = (setsCountByDate[logDate] ?? 0) + 1;
          }

          const ex = row.exercise as unknown as {
            id: string;
            name: string;
            primary_muscle: MuscleGroup;
          } | null;
          if (!ex?.primary_muscle) continue;

          if (!muscleMap.has(ex.primary_muscle)) {
            muscleMap.set(ex.primary_muscle, { sets: 0, exercises: new Map() });
          }
          const mEntry = muscleMap.get(ex.primary_muscle)!;
          if (isCompletedSet) {
            mEntry.sets += 1;
          }

          if (!mEntry.exercises.has(ex.id)) {
            mEntry.exercises.set(ex.id, {
              exerciseName: ex.name,
              totalSets: 0,
              byDate: new Map(),
            });
          }
          const exEntry = mEntry.exercises.get(ex.id)!;
          if (isCompletedSet) {
            exEntry.totalSets += 1;
          }
          if (!exEntry.byDate.has(logDate)) {
            exEntry.byDate.set(logDate, []);
          }
          exEntry.byDate.get(logDate)!.push({
            weight_kg: Number(row.weight_kg),
            reps: row.reps,
          });
        }

        const compiled: MuscleVolumeItem[] = Array.from(muscleMap.entries())
          .map(([muscle, data]) => ({
            muscle,
            sets: data.sets,
            exercises: Array.from(data.exercises.entries()).map(([exerciseId, exData]) => ({
              exerciseId,
              exerciseName: exData.exerciseName,
              totalSets: exData.totalSets,
              byDay: Array.from(exData.byDate.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, sets]) => ({
                  date,
                  dayLabel: formatShortDateLabel(date).dateLabel,
                  sets,
                })),
            })),
          }))
          .sort((a, b) => b.sets - a.sets);

        setMuscleVolume(compiled);
      } else {
        setMuscleVolume([]);
      }

      // Discipline counts & Excel rows
      const nextDiscCounts: Record<DisciplineKey, number> = {
        no_porn: 0,
        no_alcohol: 0,
        no_junk: 0,
        no_smoking: 0,
        creatine: 0,
        stretching: 0,
      };
      let totalChecksDone = 0;

      const dailyByDate = new Map(thisWeekDaily.map((d) => [d.log_date, d]));
      const rows: WeekDayExcelRow[] = weekDates.map((dateStr, idx) => {
        const { dayShort, dateLabel } = formatShortDateLabel(dateStr);
        const sess = sessionByDate.get(dateStr);
        const daily = dailyByDate.get(dateStr);
        const food = foodByDay[dateStr];
        const disc = disciplineMaps[idx] ?? {};

        let discDone = 0;
        for (const item of DISCIPLINE_ITEMS) {
          if (disc[item.key]) {
            discDone += 1;
            nextDiscCounts[item.key] += 1;
            totalChecksDone += 1;
          }
        }

        const isSunday = idx === 6;
        return {
          date: dateStr,
          dayShort,
          dateLabel,
          workoutName: sess?.split_name ?? (isSunday ? 'Rest Day' : '—'),
          workoutStatus:
            sess?.status === 'completed'
              ? 'completed'
              : sess
                ? 'in_progress'
                : 'none',
          setsCount: setsCountByDate[dateStr] ?? 0,
          calories: food ? Math.round(food.cal) : 0,
          proteinG: food ? Math.round(food.pro) : 0,
          waterGlasses: daily?.water_glasses ?? 0,
          steps: (daily?.steps_treadmill ?? 0) + (daily?.steps_other ?? 0),
          weightKg:
            daily?.weight_post_kg != null
              ? Number(daily.weight_post_kg)
              : daily?.weight_pre_kg != null
                ? Number(daily.weight_pre_kg)
                : null,
          disciplineDone: discDone,
        };
      });

      setDayRows(rows);
      setDisciplineCounts(nextDiscCounts);

      // Gamification percentages
      const workoutPct = Math.min(100, Math.round((workoutsCompleted / 6) * 100));
      const calHitDays = rows.filter(
        (r) => r.calories > 0 && r.calories <= targetCalories + 150
      ).length;
      const caloriePct =
        foodDays.length > 0 ? Math.min(100, Math.round((calHitDays / 6) * 100)) : 0;

      const avgWater =
        rows.reduce((s, r) => s + r.waterGlasses, 0) /
        Math.max(1, rows.filter((r) => r.waterGlasses > 0).length);
      const hydrationPct =
        rows.some((r) => r.waterGlasses > 0)
          ? Math.min(100, Math.round((avgWater / Math.max(1, targetWater)) * 100))
          : 0;

      const activeDaysSoFar = weekDates.filter((d) => d <= todayStr).length || 7;
      const disciplinePct = Math.min(
        100,
        Math.round((totalChecksDone / (activeDaysSoFar * DISCIPLINE_ITEMS.length)) * 100)
      );

      const overallPct = Math.round(
        (workoutPct + caloriePct + hydrationPct + disciplinePct) / 4
      );
      const rank: WeeklyGamification['rank'] =
        overallPct >= 85
          ? 'S-TIER'
          : overallPct >= 70
            ? 'A-TIER'
            : overallPct >= 50
              ? 'B-TIER'
              : 'GRINDING';

      setGamification({
        overallPct,
        workoutPct,
        caloriePct,
        hydrationPct,
        disciplinePct,
        rank,
      });

      setSummary({
        avgWeightKg,
        weightDeltaKg,
        avgCalories,
        avgProteinG,
        avgSleepHours,
        avgSteps,
        workoutsCompleted,
        totalSets,
      });

      setPhotos((photoRows ?? []) as ProgressPhoto[]);
    } catch {
      // Keep existing state when offline
    } finally {
      setLoading(false);
    }
  }, [prevWeekStart, targetCalories, targetWater, todayStr, user, weekEnd, weekStart]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadProgress();
    })();
  }, [loadProgress]);

  return {
    weekStart,
    weekEnd,
    summary,
    dayRows,
    muscleVolume,
    gamification,
    disciplineCounts,
    photos,
    loading,
    refresh: loadProgress,
  };
}
