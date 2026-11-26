import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
}

export interface MuscleVolumeItem {
  muscle: MuscleGroup;
  sets: number;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function useWeeklyProgress() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WeeklyCheckinSummary>({
    avgWeightKg: null,
    weightDeltaKg: null,
    avgCalories: 0,
    avgProteinG: 0,
    avgSleepHours: null,
    avgSteps: 0,
    workoutsCompleted: 0,
  });
  const [muscleVolume, setMuscleVolume] = useState<MuscleVolumeItem[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProgress = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const weekStart = dateDaysAgo(6);
    const prevWeekStart = dateDaysAgo(13);

    try {
      const [
        { data: dailyRows },
        { data: foodRows },
        { data: sessionRows },
        { data: photoRows },
      ] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('log_date', prevWeekStart)
          .order('log_date', { ascending: false }),
        supabase
          .from('food_logs')
          .select('log_date, calories, protein_g')
          .eq('user_id', user.id)
          .gte('log_date', weekStart),
        supabase
          .from('workout_sessions')
          .select('id, status, log_date')
          .eq('user_id', user.id)
          .gte('log_date', weekStart),
        supabase
          .from('progress_photos')
          .select('*')
          .eq('user_id', user.id)
          .order('log_date', { ascending: false })
          .limit(30),
      ]);

      // 1. Weight, Sleep & Steps (current 7d vs previous 7d)
      const thisWeekDaily = (dailyRows ?? []).filter((r) => r.log_date >= weekStart);
      const prevWeekDaily = (dailyRows ?? []).filter((r) => r.log_date < weekStart);

      const getAvgWeight = (rows: typeof thisWeekDaily) => {
        const weights = rows
          .map((r) => (r.weight_pre_kg ? Number(r.weight_pre_kg) : null))
          .filter((w): w is number => w !== null);
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

      const stepsTotals = thisWeekDaily.map(
        (r) => (r.steps_treadmill ?? 0) + (r.steps_other ?? 0)
      );
      const avgSteps =
        stepsTotals.length > 0
          ? Math.round(stepsTotals.reduce((a, b) => a + b, 0) / stepsTotals.length)
          : 0;

      // 2. Nutrition Averages (grouped by days logged)
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

      // 3. Workouts & Weekly Muscle Volume Counter (exclude warmup sets)
      const sessionIds = (sessionRows ?? []).map((s) => s.id);
      const workoutsCompleted = (sessionRows ?? []).filter(
        (s) => s.status === 'completed'
      ).length;

      if (sessionIds.length > 0) {
        const { data: setRows } = await supabase
          .from('workout_sets')
          .select('set_type, exercise:exercises(primary_muscle)')
          .in('session_id', sessionIds)
          .neq('set_type', 'warmup');

        const counts: Partial<Record<MuscleGroup, number>> = {};
        for (const row of setRows ?? []) {
          const ex = row.exercise as unknown as { primary_muscle: MuscleGroup } | null;
          if (ex?.primary_muscle) {
            counts[ex.primary_muscle] = (counts[ex.primary_muscle] ?? 0) + 1;
          }
        }
        const sorted = Object.entries(counts)
          .map(([muscle, sets]) => ({ muscle: muscle as MuscleGroup, sets: sets ?? 0 }))
          .sort((a, b) => b.sets - a.sets);
        setMuscleVolume(sorted);
      } else {
        setMuscleVolume([]);
      }

      setSummary({
        avgWeightKg,
        weightDeltaKg,
        avgCalories,
        avgProteinG,
        avgSleepHours,
        avgSteps,
        workoutsCompleted,
      });
      setPhotos((photoRows ?? []) as ProgressPhoto[]);
    } catch {
      // Ignore offline errors
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadProgress();
    })();
  }, [loadProgress]);

  return {
    summary,
    muscleVolume,
    photos,
    loading,
    refresh: loadProgress,
  };
}
