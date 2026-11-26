import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedDate } from '../context/DateContext';
import { getCachedJson, setCachedJson } from '../lib/storage';
import { supabase } from '../lib/supabase';
import {
  EffortLevel,
  Exercise,
  ExerciseStatus,
  SetType,
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSet,
} from '../types/database';
import { DaySplitWithExercises } from './useSplit';

interface CachedWorkoutState {
  session: WorkoutSession | null;
  sessionExercises: WorkoutSessionExercise[];
  sets: WorkoutSet[];
  weightPreKg: number | null;
  weightPostKg: number | null;
}

export interface PreviousSetSummary {
  weight_kg: number;
  reps: number;
}

export function useWorkoutSession(todaySplit?: DaySplitWithExercises) {
  const { user } = useAuth();
  const { selectedDate: today } = useSelectedDate();
  const cacheKey = `gym_workout_${today}_v1`;

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sessionExercises, setSessionExercises] = useState<WorkoutSessionExercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [previousByExercise, setPreviousByExercise] = useState<Record<string, PreviousSetSummary>>({});
  const [weightPreKg, setWeightPreKg] = useState<number | null>(null);
  const [weightPostKg, setWeightPostKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const persistCache = useCallback(
    (next: Partial<CachedWorkoutState>) => {
      setCachedJson<CachedWorkoutState>(cacheKey, {
        session: next.session !== undefined ? next.session : session,
        sessionExercises:
          next.sessionExercises !== undefined ? next.sessionExercises : sessionExercises,
        sets: next.sets !== undefined ? next.sets : sets,
        weightPreKg: next.weightPreKg !== undefined ? next.weightPreKg : weightPreKg,
        weightPostKg: next.weightPostKg !== undefined ? next.weightPostKg : weightPostKg,
      });
    },
    [cacheKey, session, sessionExercises, sets, weightPreKg, weightPostKg]
  );

  const loadPreviousSets = useCallback(
    async (exerciseIds: string[], currentSessionId: string) => {
      if (!user || exerciseIds.length === 0) return;
      try {
        const { data } = await supabase
          .from('workout_sets')
          .select('exercise_id, weight_kg, reps, session_id, set_type, logged_at')
          .in('exercise_id', exerciseIds)
          .neq('session_id', currentSessionId)
          .neq('set_type', 'warmup')
          .order('logged_at', { ascending: false })
          .limit(100);

        if (!data) return;
        const map: Record<string, PreviousSetSummary> = {};
        for (const row of data) {
          if (!map[row.exercise_id]) {
            map[row.exercise_id] = {
              weight_kg: Number(row.weight_kg),
              reps: row.reps,
            };
          }
        }
        setPreviousByExercise(map);
      } catch {
        // Ignore offline
      }
    },
    [user]
  );

  const loadTodaySession = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const cached = await getCachedJson<CachedWorkoutState>(cacheKey);
    if (cached) {
      setSession(cached.session);
      setSessionExercises(cached.sessionExercises);
      setSets(cached.sets);
      setWeightPreKg(cached.weightPreKg);
      setWeightPostKg(cached.weightPostKg);
    }

    try {
      const [{ data: dailyData }, { data: existingSession }] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('weight_pre_kg, weight_post_kg')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .maybeSingle(),
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (dailyData) {
        setWeightPreKg(dailyData.weight_pre_kg ? Number(dailyData.weight_pre_kg) : null);
        setWeightPostKg(dailyData.weight_post_kg ? Number(dailyData.weight_post_kg) : null);
      }

      if (existingSession) {
        const typedSession = existingSession as WorkoutSession;
        const [{ data: seData }, { data: setData }] = await Promise.all([
          supabase
            .from('workout_session_exercises')
            .select('*, exercise:exercises(*)')
            .eq('session_id', typedSession.id)
            .order('order_index'),
          supabase
            .from('workout_sets')
            .select('*')
            .eq('session_id', typedSession.id)
            .order('logged_at'),
        ]);

        const nextSe = (seData ?? []) as WorkoutSessionExercise[];
        const nextSets = (setData ?? []) as WorkoutSet[];
        setSession(typedSession);
        setSessionExercises(nextSe);
        setSets(nextSets);
        persistCache({ session: typedSession, sessionExercises: nextSe, sets: nextSets });

        await loadPreviousSets(
          nextSe.map((e) => e.exercise_id),
          typedSession.id
        );
      } else {
        setSession(null);
        setSessionExercises([]);
        setSets([]);
      }
    } catch {
      // Keep cached data if offline
    } finally {
      setLoading(false);
    }
  }, [cacheKey, loadPreviousSets, persistCache, today, user]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadTodaySession();
    })();
  }, [loadTodaySession]);

  const startTodayWorkout = async () => {
    if (!user) return;
    const splitName = todaySplit?.split.split_name ?? 'Freestyle Workout';

    const { data: newSession, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        log_date: today,
        split_name: splitName,
        status: 'in_progress',
      })
      .select()
      .single();

    if (error) throw error;
    const typedSession = newSession as WorkoutSession;

    if (todaySplit && todaySplit.exercises.length > 0) {
      const rows = todaySplit.exercises.map((se, index) => ({
        session_id: typedSession.id,
        exercise_id: se.exercise_id,
        order_index: index,
        status: 'pending' as ExerciseStatus,
      }));
      await supabase.from('workout_session_exercises').insert(rows);
    }

    await loadTodaySession();
  };

  const addExerciseToSession = async (exercise: Exercise) => {
    if (!session) return;
    const alreadyExists = sessionExercises.some((se) => se.exercise_id === exercise.id);
    if (alreadyExists) return;

    const { data, error } = await supabase
      .from('workout_session_exercises')
      .insert({
        session_id: session.id,
        exercise_id: exercise.id,
        order_index: sessionExercises.length,
        status: 'in_progress',
      })
      .select('*, exercise:exercises(*)')
      .single();

    if (error) throw error;
    const next = [...sessionExercises, data as WorkoutSessionExercise];
    setSessionExercises(next);
    persistCache({ sessionExercises: next });
    await loadPreviousSets([exercise.id], session.id);
  };

  /**
   * Non-linear switching: sets exercise status (pending | in_progress | completed)
   * without affecting any other exercise in the session.
   */
  const setExerciseStatus = async (exerciseId: string, status: ExerciseStatus) => {
    if (!session) return;
    const next = sessionExercises.map((se) =>
      se.exercise_id === exerciseId ? { ...se, status } : se
    );
    setSessionExercises(next);
    persistCache({ sessionExercises: next });

    await supabase
      .from('workout_session_exercises')
      .update({ status })
      .eq('session_id', session.id)
      .eq('exercise_id', exerciseId);
  };

  const logSet = async (params: {
    exerciseId: string;
    weightKg: number;
    reps: number;
    setType: SetType;
    effort: EffortLevel;
  }) => {
    if (!session) return;
    const existingForExercise = sets.filter((s) => s.exercise_id === params.exerciseId);
    const setNumber = existingForExercise.length + 1;

    const { data, error } = await supabase
      .from('workout_sets')
      .insert({
        session_id: session.id,
        exercise_id: params.exerciseId,
        set_number: setNumber,
        weight_kg: params.weightKg,
        reps: params.reps,
        set_type: params.setType,
        effort: params.effort,
      })
      .select()
      .single();

    if (error) throw error;
    const nextSets = [...sets, data as WorkoutSet];
    setSets(nextSets);
    persistCache({ sets: nextSets });

    // Automatically mark exercise as 'in_progress' if it was 'pending'
    const currentEx = sessionExercises.find((se) => se.exercise_id === params.exerciseId);
    if (currentEx && currentEx.status === 'pending') {
      await setExerciseStatus(params.exerciseId, 'in_progress');
    }
  };

  const deleteSet = async (setId: string) => {
    const nextSets = sets.filter((s) => s.id !== setId);
    setSets(nextSets);
    persistCache({ sets: nextSets });
    await supabase.from('workout_sets').delete().eq('id', setId);
  };

  const finishWorkout = async () => {
    if (!session) return;
    const completedAt = new Date().toISOString();
    const updated = { ...session, status: 'completed' as const, completed_at: completedAt };
    setSession(updated);
    persistCache({ session: updated });

    await supabase
      .from('workout_sessions')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', session.id);
  };

  const saveWorkoutWeight = async (type: 'pre' | 'post', weightKg: number | null) => {
    if (!user) return;
    if (type === 'pre') setWeightPreKg(weightKg);
    else setWeightPostKg(weightKg);

    const payload: {
      user_id: string;
      log_date: string;
      weight_pre_kg?: number | null;
      weight_post_kg?: number | null;
    } =
      type === 'pre'
        ? { user_id: user.id, log_date: today, weight_pre_kg: weightKg }
        : { user_id: user.id, log_date: today, weight_post_kg: weightKg };

    await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,log_date' });
  };

  return {
    session,
    sessionExercises,
    sets,
    previousByExercise,
    weightPreKg,
    weightPostKg,
    loading,
    refresh: loadTodaySession,
    startTodayWorkout,
    addExerciseToSession,
    setExerciseStatus,
    logSet,
    deleteSet,
    finishWorkout,
    saveWorkoutWeight,
  };
}
