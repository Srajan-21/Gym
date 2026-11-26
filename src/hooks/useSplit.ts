import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCachedJson, setCachedJson } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { Exercise, SplitExercise, WeeklySplit } from '../types/database';

export interface DaySplitWithExercises {
  split: WeeklySplit;
  exercises: SplitExercise[];
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
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [splitsByDay, setSplitsByDay] = useState<Record<number, DaySplitWithExercises>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [cachedExercises, cachedSplits] = await Promise.all([
      getCachedJson<Exercise[]>(CACHE_KEY_EXERCISES),
      getCachedJson<Record<number, DaySplitWithExercises>>(CACHE_KEY_SPLITS),
    ]);

    if (cachedExercises) setExercises(cachedExercises);
    if (cachedSplits) setSplitsByDay(cachedSplits);

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
  }, [user]);

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
      target_sets: targetSets,
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

  return {
    exercises,
    splitsByDay,
    loading,
    refresh: loadData,
    upsertDaySplit,
    addExerciseToDay,
    removeExerciseFromDay,
    createCustomExercise,
  };
}
