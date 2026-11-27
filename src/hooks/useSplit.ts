import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDayOfWeekFromDate } from '../context/DateContext';
import { getCachedJson, setCachedJson } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { Exercise, SplitExercise, WeeklySplit } from '../types/database';

export interface DaySplitWithExercises {
  split: WeeklySplit;
  exercises: SplitExercise[];
}

export interface SplitPeriodDay {
  splitName: string;
  isRestDay: boolean;
  exercises: SplitExercise[];
}

export interface SplitPeriodPlan {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: Record<number, SplitPeriodDay>;
  createdAt: string;
}

const CACHE_KEY_SPLITS = 'gym_weekly_splits_v1';
const CACHE_KEY_EXERCISES = 'gym_exercises_v1';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const FULL_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function useSplit() {
  const { user } = useAuth();
  const periodCacheKey = user ? `gym_period_splits_${user.id}_v1` : '';
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [splitsByDay, setSplitsByDay] = useState<Record<number, DaySplitWithExercises>>({});
  const [periodPlans, setPeriodPlans] = useState<SplitPeriodPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [cachedExercises, cachedSplits, cachedPeriods] = await Promise.all([
      getCachedJson<Exercise[]>(CACHE_KEY_EXERCISES),
      getCachedJson<Record<number, DaySplitWithExercises>>(CACHE_KEY_SPLITS),
      getCachedJson<SplitPeriodPlan[]>(periodCacheKey),
    ]);

    if (cachedExercises) setExercises(cachedExercises);
    if (cachedSplits) setSplitsByDay(cachedSplits);
    if (cachedPeriods) setPeriodPlans(cachedPeriods);

    try {
      const [{ data: exData }, { data: splitData }] = await Promise.all([
        supabase.from('exercises').select('*').order('name'),
        supabase.from('weekly_splits').select('*').eq('user_id', user.id),
      ]);

      if (exData) {
        setExercises(exData as Exercise[]);
        setCachedJson(CACHE_KEY_EXERCISES, exData);
      }

      if (splitData && splitData.length > 0) {
        const splitIds = splitData.map((s) => s.id);
        const { data: splitExData } = await supabase
          .from('split_exercises')
          .select('*, exercise:exercises(*)')
          .in('split_id', splitIds)
          .order('order_index');

        const map: Record<number, DaySplitWithExercises> = {};
        for (const s of splitData as WeeklySplit[]) {
          map[s.day_of_week] = {
            split: s,
            exercises: ((splitExData ?? []) as SplitExercise[]).filter(
              (se) => se.split_id === s.id
            ),
          };
        }
        setSplitsByDay(map);
        setCachedJson(CACHE_KEY_SPLITS, map);
      } else {
        setSplitsByDay({});
      }
    } catch {
      // Fallback silently to cached data when offline
    } finally {
      setLoading(false);
    }
  }, [periodCacheKey, user]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadData();
    })();
  }, [loadData]);

  const upsertDaySplit = async (
    dayOfWeek: number,
    splitName: string,
    isRestDay: boolean
  ): Promise<WeeklySplit | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('weekly_splits')
      .upsert(
        {
          user_id: user.id,
          day_of_week: dayOfWeek,
          split_name: splitName.trim() || (isRestDay ? 'Rest Day' : 'Workout'),
          is_rest_day: isRestDay,
        },
        { onConflict: 'user_id,day_of_week' }
      )
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data as WeeklySplit;
  };

  const addExerciseToDay = async (
    dayOfWeek: number,
    exerciseId: string,
    targetSets = 3,
    targetRepRange = '8-12'
  ) => {
    if (!user) return;
    let split = splitsByDay[dayOfWeek]?.split;
    if (!split) {
      const created = await upsertDaySplit(dayOfWeek, `${FULL_DAY_NAMES[dayOfWeek]} Split`, false);
      if (!created) return;
      split = created;
    }

    const currentList = splitsByDay[dayOfWeek]?.exercises ?? [];
    const { error } = await supabase.from('split_exercises').insert({
      split_id: split.id,
      exercise_id: exerciseId,
      order_index: currentList.length,
      target_sets: Math.max(1, targetSets),
      target_rep_range: targetRepRange,
    });

    if (error) throw error;
    await loadData();
  };

  const removeExerciseFromDay = async (splitExerciseId: string) => {
    const { error } = await supabase
      .from('split_exercises')
      .delete()
      .eq('id', splitExerciseId);
    if (error) throw error;
    await loadData();
  };

  const createCustomExercise = async (
    name: string,
    primaryMuscle: Exercise['primary_muscle'],
    equipment: Exercise['equipment']
  ): Promise<Exercise | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('exercises')
      .insert({
        user_id: user.id,
        name: name.trim(),
        primary_muscle: primaryMuscle,
        equipment,
      })
      .select()
      .single();

    if (error) throw error;
    await loadData();
    return data as Exercise;
  };

  const persistPeriodPlans = async (next: SplitPeriodPlan[]) => {
    setPeriodPlans(next);
    if (periodCacheKey) {
      await setCachedJson(periodCacheKey, next);
    }
  };

  const createPeriodPlan = async (
    name: string,
    startDate: string,
    endDate: string
  ): Promise<SplitPeriodPlan | null> => {
    if (!user) return null;
    const trimmedStart = startDate.trim();
    const trimmedEnd = endDate.trim();
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRe.test(trimmedStart) || !isoRe.test(trimmedEnd)) {
      throw new Error('Use YYYY-MM-DD format for From and To dates.');
    }
    if (trimmedEnd < trimmedStart) {
      throw new Error('End date must be on or after start date.');
    }
    const plan: SplitPeriodPlan = {
      id: `period_${Date.now()}`,
      name: name.trim() || `${trimmedStart} to ${trimmedEnd}`,
      startDate: trimmedStart,
      endDate: trimmedEnd,
      days: {},
      createdAt: new Date().toISOString(),
    };
    const next = [plan, ...periodPlans];
    await persistPeriodPlans(next);
    return plan;
  };

  const deletePeriodPlan = async (planId: string) => {
    await persistPeriodPlans(periodPlans.filter((p) => p.id !== planId));
  };

  const upsertPeriodDaySplit = async (
    planId: string,
    dayOfWeek: number,
    splitName: string,
    isRestDay: boolean
  ) => {
    const next = periodPlans.map((p) => {
      if (p.id !== planId) return p;
      const existing = p.days[dayOfWeek];
      return {
        ...p,
        days: {
          ...p.days,
          [dayOfWeek]: {
            splitName: splitName.trim() || (isRestDay ? 'Rest Day' : `${FULL_DAY_NAMES[dayOfWeek]} Split`),
            isRestDay,
            exercises: existing?.exercises ?? [],
          },
        },
      };
    });
    await persistPeriodPlans(next);
  };

  const addExerciseToPeriodDay = async (
    planId: string,
    dayOfWeek: number,
    exerciseId: string,
    targetSets = 3,
    targetRepRange = '8-12'
  ) => {
    const exObj = exercises.find((e) => e.id === exerciseId);
    const next = periodPlans.map((p) => {
      if (p.id !== planId) return p;
      const existing = p.days[dayOfWeek] ?? {
        splitName: `${FULL_DAY_NAMES[dayOfWeek]} Split`,
        isRestDay: false,
        exercises: [],
      };
      const newItem: SplitExercise = {
        id: `pe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        split_id: `${planId}_${dayOfWeek}`,
        exercise_id: exerciseId,
        order_index: existing.exercises.length,
        target_sets: Math.max(1, targetSets),
        target_rep_range: targetRepRange,
        exercise: exObj,
      };
      return {
        ...p,
        days: {
          ...p.days,
          [dayOfWeek]: {
            ...existing,
            isRestDay: false,
            exercises: [...existing.exercises, newItem],
          },
        },
      };
    });
    await persistPeriodPlans(next);
  };

  const removeExerciseFromPeriodDay = async (
    planId: string,
    dayOfWeek: number,
    splitExerciseId: string
  ) => {
    const next = periodPlans.map((p) => {
      if (p.id !== planId) return p;
      const existing = p.days[dayOfWeek];
      if (!existing) return p;
      return {
        ...p,
        days: {
          ...p.days,
          [dayOfWeek]: {
            ...existing,
            exercises: existing.exercises.filter((e) => e.id !== splitExerciseId),
          },
        },
      };
    });
    await persistPeriodPlans(next);
  };

  const getSplitForDate = useCallback(
    (dateStr: string): { data: DaySplitWithExercises | undefined; activePlan: SplitPeriodPlan | null } => {
      const dayOfWeek = getDayOfWeekFromDate(dateStr);
      const matchingPlan = periodPlans.find(
        (p) => p.startDate <= dateStr && dateStr <= p.endDate
      );
      if (matchingPlan) {
        const dayEntry = matchingPlan.days[dayOfWeek];
        if (!dayEntry) {
          return { data: undefined, activePlan: matchingPlan };
        }
        return {
          activePlan: matchingPlan,
          data: {
            split: {
              id: `${matchingPlan.id}_${dayOfWeek}`,
              user_id: user?.id ?? '',
              day_of_week: dayOfWeek,
              split_name: dayEntry.splitName,
              is_rest_day: dayEntry.isRestDay,
            },
            exercises: dayEntry.exercises,
          },
        };
      }
      return { data: splitsByDay[dayOfWeek], activePlan: null };
    },
    [periodPlans, splitsByDay, user?.id]
  );

  return {
    exercises,
    splitsByDay,
    periodPlans,
    loading,
    refresh: loadData,
    getSplitForDate,
    upsertDaySplit,
    addExerciseToDay,
    removeExerciseFromDay,
    createPeriodPlan,
    deletePeriodPlan,
    upsertPeriodDaySplit,
    addExerciseToPeriodDay,
    removeExerciseFromPeriodDay,
    createCustomExercise,
  };
}
