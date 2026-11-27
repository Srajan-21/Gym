import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedDate } from '../context/DateContext';
import { uploadProgressPhoto } from '../lib/cloudinary';
import { getCachedJson, setCachedJson } from '../lib/storage';
import { supabase } from '../lib/supabase';
import { DailyLog, PoseTag, ProgressPhoto } from '../types/database';

export function useDailyHabits() {
  const { user } = useAuth();
  const { selectedDate: today } = useSelectedDate();
  const cacheKey = `gym_daily_log_${today}_v1`;
  const photosCacheKey = `gym_daily_photos_${today}_v1`;

  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [todayPhotos, setTodayPhotos] = useState<ProgressPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const loadHabits = useCallback(async () => {
    if (!user) return;
    const [cached, cachedPhotos] = await Promise.all([
      getCachedJson<DailyLog | null>(cacheKey),
      getCachedJson<ProgressPhoto[]>(photosCacheKey),
    ]);
    setDailyLog(cached ?? null);
    setTodayPhotos(cachedPhotos ?? []);

    try {
      const [{ data: logData }, { data: photoData }] = await Promise.all([
        supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .maybeSingle(),
        supabase
          .from('progress_photos')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', today)
          .order('created_at', { ascending: false }),
      ]);

      const nextLog = (logData as DailyLog | null) ?? null;
      setDailyLog(nextLog);
      setCachedJson(cacheKey, nextLog);

      if (photoData) {
        const nextPhotos = photoData as ProgressPhoto[];
        setTodayPhotos(nextPhotos);
        setCachedJson(photosCacheKey, nextPhotos);
      }
    } catch {
      // Offline fallback to cache
    }
  }, [cacheKey, photosCacheKey, today, user]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadHabits();
    })();
  }, [loadHabits]);

  const sleepDurationHours = useMemo(() => {
    if (!dailyLog?.sleep_time || !dailyLog?.wake_time) return null;
    const start = new Date(dailyLog.sleep_time).getTime();
    const end = new Date(dailyLog.wake_time).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return Math.round(((end - start) / (1000 * 60 * 60)) * 10) / 10;
  }, [dailyLog]);

  const upsertFields = async (fields: Partial<DailyLog>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('daily_logs')
      .upsert(
        {
          user_id: user.id,
          log_date: today,
          ...fields,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,log_date' }
      )
      .select()
      .single();

    if (error) throw error;
    setDailyLog(data as DailyLog);
    setCachedJson(cacheKey, data);
  };

  const adjustWater = async (delta: number) => {
    const next = Math.max(0, (dailyLog?.water_glasses ?? 0) + delta);
    await upsertFields({ water_glasses: next });
  };

  const saveSteps = async (treadmill: number, other: number) => {
    await upsertFields({
      steps_treadmill: Math.max(0, treadmill),
      steps_other: Math.max(0, other),
    });
  };

  const saveWeight = async (preKg: number | null, postKg: number | null) => {
    await upsertFields({
      weight_pre_kg: preKg,
      weight_post_kg: postKg,
    });
  };

  const buildSleepTimestamps = (bedHHMM: string, wakeHHMM: string) => {
    const [bH, bM] = bedHHMM.split(':').map((n) => parseInt(n, 10));
    const [wH, wM] = wakeHHMM.split(':').map((n) => parseInt(n, 10));
    if ([bH, bM, wH, wM].some((n) => Number.isNaN(n))) {
      throw new Error('Use HH:MM format (e.g. 23:15 and 06:45)');
    }

    const wakeDate = new Date(`${today}T00:00:00`);
    wakeDate.setHours(wH, wM, 0, 0);

    const sleepDate = new Date(`${today}T00:00:00`);
    sleepDate.setHours(bH, bM, 0, 0);
    if (sleepDate >= wakeDate) {
      sleepDate.setDate(sleepDate.getDate() - 1);
    }

    return {
      sleep_time: sleepDate.toISOString(),
      wake_time: wakeDate.toISOString(),
    };
  };

  /**
   * Accepts HH:MM (24h) strings for bedTime and wakeTime.
   * If bedTime >= wakeTime (e.g. 23:30 -> 07:00), bedTime is treated as yesterday.
   */
  const saveSleep = async (bedHHMM: string, wakeHHMM: string) => {
    await upsertFields(buildSleepTimestamps(bedHHMM, wakeHHMM));
  };

  const saveBulkDayHabits = async (params: {
    waterGlasses?: number | null;
    treadmillSteps?: number | null;
    otherSteps?: number | null;
    preWeightKg?: number | null;
    postWeightKg?: number | null;
    bedHHMM?: string;
    wakeHHMM?: string;
  }) => {
    const fields: Partial<DailyLog> = {};
    if (params.waterGlasses !== undefined && params.waterGlasses !== null) {
      fields.water_glasses = Math.max(0, params.waterGlasses);
    }
    if (params.treadmillSteps !== undefined && params.treadmillSteps !== null) {
      fields.steps_treadmill = Math.max(0, params.treadmillSteps);
    }
    if (params.otherSteps !== undefined && params.otherSteps !== null) {
      fields.steps_other = Math.max(0, params.otherSteps);
    }
    if (params.preWeightKg !== undefined) {
      fields.weight_pre_kg = params.preWeightKg;
    }
    if (params.postWeightKg !== undefined) {
      fields.weight_post_kg = params.postWeightKg;
    }
    if (params.bedHHMM?.trim() && params.wakeHHMM?.trim()) {
      Object.assign(fields, buildSleepTimestamps(params.bedHHMM.trim(), params.wakeHHMM.trim()));
    }
    await upsertFields(fields);
  };

  const addProgressPhoto = async (localUri: string, poseTag: PoseTag) => {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadProgressPhoto(localUri, today);
      const { data, error } = await supabase
        .from('progress_photos')
        .insert({
          user_id: user.id,
          log_date: today,
          cloudinary_url: uploaded.secure_url,
          cloudinary_public_id: uploaded.public_id,
          pose_tag: poseTag,
        })
        .select()
        .single();

      if (error) throw error;
      setTodayPhotos((prev) => {
        const next = [data as ProgressPhoto, ...prev];
        setCachedJson(photosCacheKey, next);
        return next;
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  return {
    dailyLog,
    todayPhotos,
    sleepDurationHours,
    uploadingPhoto,
    refresh: loadHabits,
    adjustWater,
    saveSteps,
    saveWeight,
    saveSleep,
    saveBulkDayHabits,
    addProgressPhoto,
  };
}
