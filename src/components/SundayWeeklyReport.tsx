import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Award, Calendar, CheckCircle2, TrendingUp } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { addDays } from '../context/DateContext';
import { supabase } from '../lib/supabase';
import { Colors } from '../theme/colors';
import { DailyLog, FoodLog, ProgressPhoto, WorkoutSession } from '../types/database';

interface SundayWeeklyReportProps {
  sundayDate: string; // YYYY-MM-DD
  targetCalories: number;
  targetProteinG: number;
}

interface ReportStats {
  workoutsDone: number;
  startWeight: number | null;
  endWeight: number | null;
  weightDelta: number | null;
  avgCalories: number;
  avgProtein: number;
  calorieDaysLogged: number;
  avgWater: number;
  avgSteps: number;
  avgSleep: number | null;
  photosCount: number;
  wins: string[];
  attention: string[];
}

export function SundayWeeklyReport({
  sundayDate,
  targetCalories,
  targetProteinG,
}: SundayWeeklyReportProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReportStats | null>(null);

  const weekStart = addDays(sundayDate, -6); // Monday
  const weekEnd = addDays(sundayDate, -1); // Saturday

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [{ data: sessions }, { data: logs }, { data: foods }, { data: photos }] =
          await Promise.all([
            supabase
              .from('workout_sessions')
              .select('*')
              .eq('user_id', user.id)
              .gte('log_date', weekStart)
              .lte('log_date', weekEnd),
            supabase
              .from('daily_logs')
              .select('*')
              .eq('user_id', user.id)
              .gte('log_date', weekStart)
              .lte('log_date', weekEnd)
              .order('log_date', { ascending: true }),
            supabase
              .from('food_logs')
              .select('*')
              .eq('user_id', user.id)
              .gte('log_date', weekStart)
              .lte('log_date', weekEnd),
            supabase
              .from('progress_photos')
              .select('id')
              .eq('user_id', user.id)
              .gte('log_date', weekStart)
              .lte('log_date', sundayDate),
          ]);

        if (cancelled) return;

        const sessionList = (sessions ?? []) as WorkoutSession[];
        const logList = (logs ?? []) as DailyLog[];
        const foodList = (foods ?? []) as FoodLog[];
        const photoList = (photos ?? []) as Pick<ProgressPhoto, 'id'>[];

        const workoutsDone = sessionList.filter((s) => s.status === 'completed').length;

        const weights = logList
          .map((l) => l.weight_post_kg ?? l.weight_pre_kg)
          .filter((w): w is number => w !== null && w !== undefined)
          .map(Number);
        const startWeight = weights.length > 0 ? weights[0] : null;
        const endWeight = weights.length > 0 ? weights[weights.length - 1] : null;
        const weightDelta =
          startWeight !== null && endWeight !== null && weights.length >= 2
            ? Math.round((endWeight - startWeight) * 100) / 100
            : null;

        const foodByDay = new Map<string, { cal: number; pro: number }>();
        for (const f of foodList) {
          const cur = foodByDay.get(f.log_date) ?? { cal: 0, pro: 0 };
          cur.cal += Number(f.calories);
          cur.pro += Number(f.protein_g);
          foodByDay.set(f.log_date, cur);
        }
        const calorieDaysLogged = foodByDay.size;
        const avgCalories =
          calorieDaysLogged > 0
            ? Math.round(
                Array.from(foodByDay.values()).reduce((s, d) => s + d.cal, 0) / calorieDaysLogged
              )
            : 0;
        const avgProtein =
          calorieDaysLogged > 0
            ? Math.round(
                Array.from(foodByDay.values()).reduce((s, d) => s + d.pro, 0) / calorieDaysLogged
              )
            : 0;

        const waterDays = logList.filter((l) => l.water_glasses > 0);
        const avgWater =
          waterDays.length > 0
            ? Math.round(
                (waterDays.reduce((s, l) => s + l.water_glasses, 0) / waterDays.length) * 10
              ) / 10
            : 0;

        const stepDays = logList.filter((l) => l.steps_treadmill + l.steps_other > 0);
        const avgSteps =
          stepDays.length > 0
            ? Math.round(
                stepDays.reduce((s, l) => s + l.steps_treadmill + l.steps_other, 0) /
                  stepDays.length
              )
            : 0;

        const sleepHoursList = logList
          .filter((l) => l.sleep_time && l.wake_time)
          .map((l) => {
            const diff =
              (new Date(l.wake_time!).getTime() - new Date(l.sleep_time!).getTime()) /
              (1000 * 60 * 60);
            return diff > 0 ? diff : 0;
          })
          .filter((h) => h > 0);
        const avgSleep =
          sleepHoursList.length > 0
            ? Math.round((sleepHoursList.reduce((s, h) => s + h, 0) / sleepHoursList.length) * 10) /
              10
            : null;

        const wins: string[] = [];
        const attention: string[] = [];

        if (workoutsDone >= 5) wins.push(`Strong training consistency: ${workoutsDone}/6 workouts completed.`);
        else if (workoutsDone >= 3) wins.push(`Completed ${workoutsDone}/6 workouts this week.`);
        else attention.push(`Only ${workoutsDone}/6 workouts completed — aim for 4+ sessions next week.`);

        if (weightDelta !== null && weightDelta < 0) {
          wins.push(`Weight dropped ${Math.abs(weightDelta)} kg (${startWeight} → ${endWeight} kg).`);
        } else if (weightDelta !== null && weightDelta > 0.5) {
          attention.push(`Weight trended up +${weightDelta} kg (${startWeight} → ${endWeight} kg).`);
        }

        if (calorieDaysLogged < 4) {
          attention.push(`Meals logged on only ${calorieDaysLogged}/6 days — log daily for accurate tracking.`);
        } else if (avgCalories > targetCalories + 150) {
          attention.push(`Avg calories (${avgCalories} kcal) exceeded your ${targetCalories} kcal target.`);
        } else {
          wins.push(`Calories averaged ${avgCalories} kcal/day (target ${targetCalories} kcal).`);
        }

        if (calorieDaysLogged > 0 && avgProtein < targetProteinG * 0.75) {
          attention.push(`Protein averaged ${avgProtein}g/day vs ${targetProteinG}g target.`);
        }

        if (avgWater === 0) {
          attention.push('Water intake was not logged this week.');
        } else if (avgWater < 7) {
          attention.push(`Water averaged ${avgWater} glasses/day — aim for 8+ glasses.`);
        } else {
          wins.push(`Hydration on track: ${avgWater} glasses/day.`);
        }

        if (avgSleep === null) {
          attention.push('Sleep & wake times were not logged this week.');
        } else if (avgSleep < 7) {
          attention.push(`Sleep averaged ${avgSleep} hrs/night — target 7–8 hrs for recovery.`);
        } else {
          wins.push(`Great recovery: ${avgSleep} hrs average sleep.`);
        }

        if (avgSteps > 0 && avgSteps < 6000) {
          attention.push(`Steps averaged ${avgSteps.toLocaleString()}/day — try to hit 7,000+ steps.`);
        } else if (avgSteps >= 6000) {
          wins.push(`Active week: ${avgSteps.toLocaleString()} avg steps/day.`);
        }

        if (photoList.length === 0) {
          attention.push('No progress photos uploaded this week.');
        }

        setStats({
          workoutsDone,
          startWeight,
          endWeight,
          weightDelta,
          avgCalories,
          avgProtein,
          calorieDaysLogged,
          avgWater,
          avgSteps,
          avgSleep,
          photosCount: photoList.length,
          wins,
          attention,
        });
      } catch {
        // Ignore offline errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sundayDate, targetCalories, targetProteinG, user.id, weekEnd, weekStart]);

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <View style={styles.rowGapSmall}>
          <View style={[styles.iconBadge, { backgroundColor: Colors.primarySoft }]}>
            <TrendingUp size={16} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.kicker}>SUNDAY WEEKLY REPORT</Text>
            <Text style={styles.cardTitle}>
              {weekStart} → {weekEnd}
            </Text>
          </View>
        </View>
      </View>

      {loading || !stats ? (
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: 16 }} />
      ) : (
        <>
          <View style={styles.grid}>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Workouts</Text>
              <Text style={styles.statValue}>{stats.workoutsDone} / 6</Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statValue}>
                {stats.endWeight !== null ? `${stats.endWeight} kg` : '—'}
              </Text>
              {stats.weightDelta !== null && (
                <Text style={styles.statHint}>
                  {stats.weightDelta > 0 ? `+${stats.weightDelta}` : stats.weightDelta} kg this wk
                </Text>
              )}
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Avg Calories</Text>
              <Text style={styles.statValue}>
                {stats.calorieDaysLogged > 0 ? `${stats.avgCalories} kcal` : '—'}
              </Text>
              <Text style={styles.statHint}>
                {stats.calorieDaysLogged > 0 ? `Protein ${stats.avgProtein}g` : 'Not logged'}
              </Text>
            </View>
            <View style={styles.statTile}>
              <Text style={styles.statLabel}>Steps &amp; Water</Text>
              <Text style={styles.statValue}>
                {stats.avgSteps > 0 ? stats.avgSteps.toLocaleString() : '—'}
              </Text>
              <Text style={styles.statHint}>
                {stats.avgWater > 0 ? `${stats.avgWater} glasses/day` : 'No water logged'}
              </Text>
            </View>
          </View>

          {stats.wins.length > 0 && (
            <View style={styles.sectionBox}>
              <View style={styles.rowGapSmall}>
                <Award size={15} color={Colors.success} />
                <Text style={[styles.sectionTitle, { color: Colors.success }]}>Progress &amp; Wins</Text>
              </View>
              {stats.wins.map((w, i) => (
                <View key={i} style={styles.bulletRow}>
                  <CheckCircle2 size={13} color={Colors.success} />
                  <Text style={styles.bulletText}>{w}</Text>
                </View>
              ))}
            </View>
          )}

          {stats.attention.length > 0 && (
            <View style={[styles.sectionBox, styles.attentionBox]}>
              <View style={styles.rowGapSmall}>
                <AlertTriangle size={15} color={Colors.amber} />
                <Text style={[styles.sectionTitle, { color: Colors.amber }]}>
                  Needs Your Attention
                </Text>
              </View>
              {stats.attention.map((a, i) => (
                <Text key={i} style={styles.bulletText}>
                  • {a}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.rowGap}>
            <Pressable
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={() => router.push('/split-planner')}
            >
              <Calendar size={15} color={Colors.primaryText} />
              <Text style={styles.primaryBtnText}>Plan Next Week Split</Text>
            </Pressable>
            <Pressable style={styles.outlineBtn} onPress={() => router.push('/(tabs)/diet')}>
              <Text style={styles.outlineBtnText}>Set Targets</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    gap: 14,
    shadowColor: '#1A1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowGap: { flexDirection: 'row', gap: 10 },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { color: Colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statTile: {
    width: '48.5%',
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 2,
  },
  statLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  statValue: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  statHint: { color: Colors.textMuted, fontSize: 11 },
  sectionBox: {
    backgroundColor: Colors.successSoft,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  attentionBox: {
    backgroundColor: Colors.amberSoft,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bulletText: { color: Colors.text, fontSize: 12, lineHeight: 17, flex: 1 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: Colors.primaryText, fontSize: 13, fontWeight: '700' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
});
