import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addDays, useSelectedDate } from '../context/DateContext';
import { getCachedJson, setCachedJson } from '../lib/storage';

export type DisciplineKey =
  | 'no_porn'
  | 'no_alcohol'
  | 'no_junk'
  | 'no_smoking'
  | 'creatine'
  | 'stretching';

export const DISCIPLINE_ITEMS: { key: DisciplineKey; label: string }[] = [
  { key: 'no_porn', label: 'No Porn' },
  { key: 'no_alcohol', label: 'No Alcohol' },
  { key: 'no_junk', label: 'No Junk / Added Sugar' },
  { key: 'no_smoking', label: 'No Smoking' },
  { key: 'creatine', label: 'Creatine / Supplements' },
  { key: 'stretching', label: 'Mobility / Stretching' },
];

export type DailyDisciplineMap = Partial<Record<DisciplineKey, boolean>>;

export function useDailyDiscipline() {
  const { user } = useAuth();
  const { selectedDate } = useSelectedDate();
  const cacheKey = `gym_discipline_${user.id}_${selectedDate}_v1`;

  const [checks, setChecks] = useState<DailyDisciplineMap>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await getCachedJson<DailyDisciplineMap>(cacheKey);
      if (!cancelled) {
        setChecks(cached ?? {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  const toggleCheck = useCallback(
    async (key: DisciplineKey) => {
      const next: DailyDisciplineMap = {
        ...checks,
        [key]: !checks[key],
      };
      setChecks(next);
      await setCachedJson(cacheKey, next);
    },
    [cacheKey, checks]
  );

  return { checks, toggleCheck };
}

export async function getWeeklyDisciplineCounts(
  userId: string,
  endDate: string
): Promise<Record<DisciplineKey, number>> {
  const counts: Record<DisciplineKey, number> = {
    no_porn: 0,
    no_alcohol: 0,
    no_junk: 0,
    no_smoking: 0,
    creatine: 0,
    stretching: 0,
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(endDate, -i));
  const results = await Promise.all(
    days.map((d) => getCachedJson<DailyDisciplineMap>(`gym_discipline_${userId}_${d}_v1`))
  );

  for (const map of results) {
    if (!map) continue;
    for (const item of DISCIPLINE_ITEMS) {
      if (map[item.key]) counts[item.key] += 1;
    }
  }
  return counts;
}
