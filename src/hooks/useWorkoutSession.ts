import { useCallback, useEffect, useRef, useState } from 'react';
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
  logDate: string;
  sets: { weight_kg: number; reps: number }[];
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

  const latestRef = useRef<CachedWorkoutState>({
    session: null,
    sessionExercises: [],
    sets: [],
    weightPreKg: null,
    weightPostKg: null,
  });
  const activeDateRef = useRef(today);

  useEffect(() => {
    latestRef.current = {
      session,
      sessionExercises,
      sets,
      weightPreKg,
      weightPostKg,
    };
    activeDateRef.current = today;
  }, [session, sessionExercises, sets, weightPreKg, weightPostKg, today]);

  const persistCache = useCallback(
    (next: Partial<CachedWorkoutState>) => {
      const cur = latestRef.current;
      setCachedJson<CachedWorkoutState>(cacheKey, {
        session: next.session !== undefined ? next.session : cur.session,
        sessionExercises:
          next.sessionExercises !== undefined ? next.sessionExercises : cur.sessionExercises,
        sets: next.sets !== undefined ? next.sets : cur.sets,
        weightPreKg: next.weightPreKg !== undefined ? next.weightPreKg : cur.weightPreKg,
        weightPostKg: next.weightPostKg !== undefined ? next.weightPostKg : cur.weightPostKg,
      });
    },
    [cacheKey]
  );

  const loadPreviousSets = useCallback(
    async (exerciseIds: string[], _currentSessionId: string) => {
      if (!user || exerciseIds.length === 0) return;
      try {
        const { data } = await supabase
          .from('workout_sets')
          .select(
            'exercise_id, weight_kg, reps, set_number, session:workout_sessions!inner(log_date, user_id)'
          )
          .eq('session.user_id', user.id)
          .lt('session.log_date', today)
          .in('exercise_id', exerciseIds)
          .neq('set_type', 'warmup')
          .order('set_number', { ascending: true });

        if (!data) return;

        // Group by exercise_id and pick only the most recent previous log_date per exercise
        const latestDateByEx: Record<string, string> = {};
        for (const row of data) {
          const sess = Array.isArray(row.session) ? row.session[0] : row.session;
          const logDate = (sess as { log_date?: string } | null)?.log_date;
          if (!logDate) continue;
          if (!latestDateByEx[row.exercise_id] || logDate > latestDateByEx[row.exercise_id]) {
            latestDateByEx[row.exercise_id] = logDate;
          }
        }

        const map: Record<string, PreviousSetSummary> = {};
        for (const row of data) {
          const sess = Array.isArray(row.session) ? row.session[0] : row.session;
          const logDate = (sess as { log_date?: string } | null)?.log_date;
          if (!logDate || logDate !== latestDateByEx[row.exercise_id]) continue;
          if (!map[row.exercise_id]) {
            map[row.exercise_id] = { logDate, sets: [] };
          }
          map[row.exercise_id].sets.push({
            weight_kg: Number(row.weight_kg),
            reps: row.reps,
          });
        }
        setPreviousByExercise(map);
      } catch {
        // Ignore offline
      }
    },
    [today, user]
  );

  const loadTodaySession = useCallback(async () => {
    const requestDate = today;
    if (!user) {
      setLoading(false);
      return;
    }

    const cached = await getCachedJson<CachedWorkoutState>(cacheKey);
    if (activeDateRef.current !== requestDate) return;
    if (cached) {
      setSession(cached.session);
      setSessionExercises(cached.sessionExercises);
      setSets(cached.sets);
      setWeightPreKg(cached.weightPreKg);
      setWeightPostKg(cached.weightPostKg);
    } else {
      setSession(null);
      setSessionExercises([]);
      setSets([]);
      setWeightPreKg(null);
      setWeightPostKg(null);
    }

    try {
      const [{ data: dailyData }, { data: existingSession }] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('weight_pre_kg, weight_post_kg')
          .eq('user_id', user.id)
          .eq('log_date', requestDate)
          .maybeSingle(),
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', requestDate)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (activeDateRef.current !== requestDate) return;
      const nextPre = dailyData?.weight_pre_kg ? Number(dailyData.weight_pre_kg) : null;
      const nextPost = dailyData?.weight_post_kg ? Number(dailyData.weight_post_kg) : null;
      setWeightPreKg(nextPre);
      setWeightPostKg(nextPost);

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

        if (activeDateRef.current !== requestDate) return;
        const nextSe = (seData ?? []) as WorkoutSessionExercise[];
        const nextSets = (setData ?? []) as WorkoutSet[];
        setSession(typedSession);
        setSessionExercises(nextSe);
        setSets(nextSets);
        persistCache({
          session: typedSession,
          sessionExercises: nextSe,
          sets: nextSets,
          weightPreKg: nextPre,
          weightPostKg: nextPost,
        });

        await loadPreviousSets(
          nextSe.map((e) => e.exercise_id),
          typedSession.id
        );
      } else {
        setSession(null);
        setSessionExercises([]);
        setSets([]);
        persistCache({
          session: null,
          sessionExercises: [],
          sets: [],
          weightPreKg: nextPre,
          weightPostKg: nextPost,
        });
      }
    } catch {
      // Keep cached data if offline
    } finally {
      if (activeDateRef.current === requestDate) {
        setLoading(false);
      }
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

  const reorderSessionExercises = async (reordered: WorkoutSessionExercise[]) => {
    const withIndices = reordered.map((item, idx) => ({ ...item, order_index: idx }));
    setSessionExercises(withIndices);
    persistCache({ sessionExercises: withIndices });
    await Promise.all(
      withIndices.map((item) =>
        supabase
          .from('workout_session_exercises')
          .update({ order_index: item.order_index })
          .eq('id', item.id)
      )
    );
  };

  const addExerciseByName = async (
    rawName: string,
    primaryMuscle: Exercise['primary_muscle'] = 'other' as Exercise['primary_muscle']
  ): Promise<WorkoutSessionExercise | null> => {
    if (!user || !session) return null;
    const name = rawName.trim();
    if (!name) return null;

    const lower = name.toLowerCase();
    const inferredMuscle: Exercise['primary_muscle'] =
      lower.includes('plank') || lower.includes('crunch') || lower.includes('ab')
        ? 'abs'
        : lower.includes('walk') || lower.includes('cycl') || lower.includes('run') || lower.includes('cardio')
          ? 'cardio'
          : primaryMuscle === ('other' as Exercise['primary_muscle'])
            ? 'chest'
            : primaryMuscle;

    const { data: existing } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();

    let ex = existing as Exercise | null;
    if (!ex) {
      const { data: created, error: exErr } = await supabase
        .from('exercises')
        .insert({
          user_id: user.id,
          name,
          primary_muscle: inferredMuscle,
          equipment: inferredMuscle === 'abs' ? 'bodyweight' : 'other',
        })
        .select()
        .single();
      if (exErr) throw exErr;
      ex = created as Exercise;
    }

    const alreadyInSession = sessionExercises.find((se) => se.exercise_id === ex.id);
    if (alreadyInSession) return alreadyInSession;

    const { data: seRow, error: seErr } = await supabase
      .from('workout_session_exercises')
      .insert({
        session_id: session.id,
        exercise_id: ex.id,
        order_index: sessionExercises.length,
        status: 'pending',
      })
      .select('*, exercise:exercises(*)')
      .single();

    if (seErr) throw seErr;
    const typed = seRow as WorkoutSessionExercise;
    const next = [...sessionExercises, typed];
    setSessionExercises(next);
    persistCache({ sessionExercises: next });
    return typed;
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
    addExerciseByName,
    reorderSessionExercises,
    setExerciseStatus,
    logSet,
    deleteSet,
    finishWorkout,
    saveWorkoutWeight,
  };
}
