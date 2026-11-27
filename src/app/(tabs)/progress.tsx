import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  BarChart3,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  PieChart,
  ShieldCheck,
  Table2,
  Trophy,
} from 'lucide-react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import { PhotoLightboxModal } from '../../components/PhotoLightboxModal';
import { DISCIPLINE_ITEMS } from '../../hooks/useDailyDiscipline';
import { useDiet } from '../../hooks/useDiet';
import { useWeeklyProgress } from '../../hooks/useWeeklyProgress';
import { getOptimizedPhotoUrl } from '../../lib/cloudinary';
import { formatSetDisplay } from '../../lib/workoutFormat';
import { Colors } from '../../theme/colors';
import { MuscleGroup, ProgressPhoto } from '../../types/database';

const PIE_COLORS = [
  '#1F4D3D',
  '#B4693E',
  '#2E6F56',
  '#6D5D7E',
  '#3B6E8C',
  '#9C7A3C',
  '#B84343',
  '#5C7A52',
];

function formatDateOnly(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

export default function ProgressScreen() {
  const { goals } = useDiet();
  const [weekOffset, setWeekOffset] = useState(0);
  const {
    weekStart,
    weekEnd,
    summary,
    dayRows,
    muscleVolume,
    gamification,
    disciplineCounts,
    photos,
    loading,
    refresh,
  } = useWeeklyProgress(weekOffset, goals.target_calories, goals.target_water_glasses);

  const [expandedMuscle, setExpandedMuscle] = useState<MuscleGroup | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<ProgressPhoto | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  // SVG Ring constants
  const ringRadius = 38;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (gamification.overallPct / 100) * ringCirc;

  // SVG Pie constants
  const totalMuscleSets = Math.max(1, muscleVolume.reduce((s, m) => s + m.sets, 0));
  const pieRadius = 36;
  const pieCirc = 2 * Math.PI * pieRadius;
  const pieSegments = muscleVolume.reduce<
    { muscle: MuscleGroup; sets: number; pct: number; dash: number; offset: number; color: string }[]
  >((acc, item, idx) => {
    const prevSum = acc.reduce((s, x) => s + x.dash, 0);
    const pct = Math.round((item.sets / totalMuscleSets) * 100);
    const dash = (item.sets / totalMuscleSets) * pieCirc;
    acc.push({
      muscle: item.muscle,
      sets: item.sets,
      pct,
      dash,
      offset: -prevSum,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    });
    return acc;
  }, []);

  const maxDaySets = Math.max(1, ...dayRows.map((d) => d.setsCount));
  const maxMuscleSets = Math.max(1, ...muscleVolume.map((m) => m.sets));

  const rankColor =
    gamification.rank === 'S-TIER'
      ? Colors.success
      : gamification.rank === 'A-TIER'
        ? Colors.primary
        : gamification.rank === 'B-TIER'
          ? Colors.amber
          : Colors.textSecondary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />
      }
    >
      {/* Week Switcher */}
      <View style={styles.weekBar}>
        <Pressable style={styles.weekArrow} onPress={() => setWeekOffset((w) => w - 1)}>
          <ChevronLeft size={18} color={Colors.text} />
        </Pressable>
        <View style={styles.weekCenter}>
          <View style={styles.rowGapSmall}>
            <Calendar size={14} color={Colors.primary} />
            <Text style={styles.weekTitle}>
              {formatDateOnly(weekStart)} – {formatDateOnly(weekEnd)}
            </Text>
          </View>
          <Text style={styles.weekSub}>
            {weekOffset === 0 ? 'Current Week' : `${Math.abs(weekOffset)} wk ago`}
          </Text>
        </View>
        <View style={styles.rowGapSmall}>
          {weekOffset !== 0 && (
            <Pressable style={styles.todayPill} onPress={() => setWeekOffset(0)}>
              <Text style={styles.todayPillText}>Now</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.weekArrow, weekOffset >= 0 && { opacity: 0.35 }]}
            disabled={weekOffset >= 0}
            onPress={() => setWeekOffset((w) => Math.min(0, w + 1))}
          >
            <ChevronRight size={18} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Gamification Score Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Trophy size={18} color={Colors.gold} />
            <Text style={styles.cardTitle}>Weekly Performance Score</Text>
          </View>
          <View style={[styles.rankBadge, { borderColor: rankColor }]}>
            <Text style={[styles.rankText, { color: rankColor }]}>{gamification.rank}</Text>
          </View>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.ringWrap}>
            <Svg width={94} height={94}>
              <G rotation="-90" origin="47, 47">
                <Circle
                  cx={47}
                  cy={47}
                  r={ringRadius}
                  stroke={Colors.surfaceElevated}
                  strokeWidth={9}
                  fill="none"
                />
                <Circle
                  cx={47}
                  cy={47}
                  r={ringRadius}
                  stroke={rankColor}
                  strokeWidth={9}
                  strokeDasharray={`${ringCirc} ${ringCirc}`}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringPct}>{gamification.overallPct}%</Text>
              <Text style={styles.ringSub}>SCORE</Text>
            </View>
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            {[
              { label: 'Workouts', pct: gamification.workoutPct, color: Colors.primary },
              { label: 'Calories', pct: gamification.caloriePct, color: Colors.amber },
              { label: 'Hydration', pct: gamification.hydrationPct, color: Colors.success },
              { label: 'Discipline', pct: gamification.disciplinePct, color: Colors.purple },
            ].map((bar) => (
              <View key={bar.label} style={{ gap: 3 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.miniStatLabel}>{bar.label}</Text>
                  <Text style={styles.miniStatPct}>{bar.pct}%</Text>
                </View>
                <View style={styles.barTrackSmall}>
                  <View
                    style={[
                      styles.barFillSmall,
                      { width: `${bar.pct}%`, backgroundColor: bar.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.quickMetricsRow}>
          <View style={styles.quickMetric}>
            <Text style={styles.qmVal}>{summary.workoutsCompleted}/6</Text>
            <Text style={styles.qmLbl}>Workouts</Text>
          </View>
          <View style={styles.quickMetric}>
            <Text style={styles.qmVal}>{summary.totalSets}</Text>
            <Text style={styles.qmLbl}>Working Sets</Text>
          </View>
          <View style={styles.quickMetric}>
            <Text style={styles.qmVal}>
              {summary.avgWeightKg !== null ? `${summary.avgWeightKg}kg` : '—'}
            </Text>
            <Text style={styles.qmLbl}>
              {summary.weightDeltaKg !== null
                ? `${summary.weightDeltaKg > 0 ? '+' : ''}${summary.weightDeltaKg}kg`
                : 'Avg Wt'}
            </Text>
          </View>
          <View style={styles.quickMetric}>
            <Text style={styles.qmVal}>{summary.avgCalories || '—'}</Text>
            <Text style={styles.qmLbl}>Avg kcal</Text>
          </View>
        </View>
      </View>

      {/* Graphs: Muscle Pie Chart & Daily Sets Bar Chart */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <PieChart size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Weekly Analytics</Text>
        </View>

        {muscleVolume.length > 0 && (
          <View style={styles.pieRow}>
            <Svg width={96} height={96}>
              <G rotation="-90" origin="48, 48">
                {pieSegments.map((seg) => (
                  <Circle
                    key={seg.muscle}
                    cx={48}
                    cy={48}
                    r={pieRadius}
                    stroke={seg.color}
                    strokeWidth={16}
                    strokeDasharray={`${seg.dash} ${pieCirc}`}
                    strokeDashoffset={seg.offset}
                    fill="none"
                  />
                ))}
              </G>
            </Svg>
            <View style={{ flex: 1, gap: 4 }}>
              {pieSegments.slice(0, 6).map((seg) => (
                <View key={seg.muscle} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                  <Text style={styles.legendLabel}>{seg.muscle}</Text>
                  <Text style={styles.legendPct}>
                    {seg.pct}% ({seg.sets})
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.chartSection}>
          <Text style={styles.miniStatLabel}>Daily Working Sets (Mon – Sun)</Text>
          <View style={styles.barChartRow}>
            {dayRows.map((d) => {
              const barH = Math.max(4, Math.round((d.setsCount / maxDaySets) * 64));
              return (
                <View key={d.date} style={styles.barCol}>
                  <Text style={styles.barColVal}>{d.setsCount || ''}</Text>
                  <Svg width={20} height={68}>
                    <Rect
                      x={2}
                      y={68 - barH}
                      width={16}
                      height={barH}
                      rx={4}
                      fill={d.setsCount > 0 ? Colors.primary : Colors.surfaceElevated}
                    />
                  </Svg>
                  <Text style={styles.barColDay}>{d.dayShort.slice(0, 2)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Excel-Style Weekly Daily Log Grid */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <Table2 size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Weekly Log Sheet (Excel View)</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.excelTable}>
            <View style={[styles.excelRow, styles.excelHeader]}>
              <Text style={[styles.excelCell, styles.colDay, styles.excelHeaderText]}>Day</Text>
              <Text style={[styles.excelCell, styles.colDate, styles.excelHeaderText]}>Date</Text>
              <Text style={[styles.excelCell, styles.colWorkout, styles.excelHeaderText]}>
                Workout
              </Text>
              <Text style={[styles.excelCell, styles.colNum, styles.excelHeaderText]}>Sets</Text>
              <Text style={[styles.excelCell, styles.colNum, styles.excelHeaderText]}>kcal</Text>
              <Text style={[styles.excelCell, styles.colNum, styles.excelHeaderText]}>Water</Text>
              <Text style={[styles.excelCell, styles.colNum, styles.excelHeaderText]}>Steps</Text>
              <Text style={[styles.excelCell, styles.colNum, styles.excelHeaderText]}>Wt(kg)</Text>
              <Text style={[styles.excelCell, styles.colNum, styles.excelHeaderText]}>Habit</Text>
            </View>
            {dayRows.map((r, idx) => (
              <View
                key={r.date}
                style={[styles.excelRow, idx % 2 === 1 && styles.excelRowAlt]}
              >
                <Text style={[styles.excelCell, styles.colDay, styles.excelBold]}>{r.dayShort}</Text>
                <Text style={[styles.excelCell, styles.colDate]}>{r.dateLabel}</Text>
                <Text style={[styles.excelCell, styles.colWorkout]} numberOfLines={1}>
                  {r.workoutName}
                </Text>
                <Text style={[styles.excelCell, styles.colNum]}>{r.setsCount || '—'}</Text>
                <Text style={[styles.excelCell, styles.colNum]}>{r.calories || '—'}</Text>
                <Text style={[styles.excelCell, styles.colNum]}>{r.waterGlasses || '—'}</Text>
                <Text style={[styles.excelCell, styles.colNum]}>
                  {r.steps ? r.steps.toLocaleString() : '—'}
                </Text>
                <Text style={[styles.excelCell, styles.colNum]}>
                  {r.weightKg !== null ? r.weightKg : '—'}
                </Text>
                <Text style={[styles.excelCell, styles.colNum]}>{r.disciplineDone}/6</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Interactive Muscle Working Sets Drill-Down */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <BarChart3 size={18} color={Colors.success} />
          <Text style={styles.cardTitle}>Working Sets by Muscle (Tap to Expand)</Text>
        </View>

        {muscleVolume.length === 0 ? (
          <Text style={styles.emptyText}>No working sets logged for this week yet.</Text>
        ) : (
          muscleVolume.map((item) => {
            const widthPct = `${Math.round((item.sets / maxMuscleSets) * 100)}%` as const;
            const isOpen = expandedMuscle === item.muscle;
            return (
              <View key={item.muscle} style={styles.muscleBlock}>
                <Pressable
                  style={styles.barRow}
                  onPress={() => setExpandedMuscle(isOpen ? null : item.muscle)}
                >
                  <Text style={styles.muscleLabel}>{item.muscle}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: widthPct }]} />
                  </View>
                  <Text style={styles.muscleCount}>{item.sets}</Text>
                  {isOpen ? (
                    <ChevronUp size={16} color={Colors.textSecondary} />
                  ) : (
                    <ChevronDown size={16} color={Colors.textSecondary} />
                  )}
                </Pressable>

                {isOpen && (
                  <View style={styles.drillWrap}>
                    {item.exercises.map((ex) => (
                      <View key={ex.exerciseId} style={styles.drillExCard}>
                        <Text style={styles.drillExName}>
                          {ex.exerciseName} ({ex.totalSets} sets)
                        </Text>
                        {ex.byDay.map((dayLog) => (
                          <View key={dayLog.date} style={styles.drillDayRow}>
                            <Text style={styles.drillDayLabel}>{dayLog.dayLabel}:</Text>
                            <Text style={styles.drillDaySets}>
                              {dayLog.sets
                                .map((s, sIdx) =>
                                  `S${sIdx + 1} ${formatSetDisplay(
                                    ex.exerciseName,
                                    s.weight_kg,
                                    s.reps
                                  )}`
                                )
                                .join('  •  ')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Weekly Discipline Scorecard */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <ShieldCheck size={18} color={Colors.purple} />
          <Text style={styles.cardTitle}>Discipline Completion</Text>
        </View>
        <View style={styles.discGrid}>
          {DISCIPLINE_ITEMS.map((item) => {
            const count = disciplineCounts[item.key] ?? 0;
            const pct = Math.round((count / 7) * 100);
            return (
              <View key={item.key} style={styles.discTile}>
                <Text style={styles.discLabel}>{item.label}</Text>
                <Text style={styles.discVal}>
                  {count}/7 ({pct}%)
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Progress Photos (Latest First, Horizontal Scroll, Dates Only) */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <Camera size={18} color={Colors.amber} />
          <Text style={styles.cardTitle}>Progress Photos</Text>
        </View>
        {photos.length === 0 ? (
          <Text style={styles.emptyText}>No progress photos uploaded yet.</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {photos.map((p) => (
              <Pressable key={p.id} style={styles.photoCard} onPress={() => setEnlargedPhoto(p)}>
                <Image
                  source={{ uri: getOptimizedPhotoUrl(p.cloudinary_url, 400) }}
                  style={styles.photoImg}
                />
                <Text style={styles.photoDate}>{formatDateOnly(p.log_date)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <PhotoLightboxModal
        photo={enlargedPhoto}
        hidePose={true}
        onClose={() => setEnlargedPhoto(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weekArrow: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCenter: { alignItems: 'center', gap: 2 },
  weekTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  weekSub: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  todayPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  todayPillText: { color: Colors.gold, fontSize: 11, fontWeight: '700' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  rankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  rankText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringWrap: { width: 94, height: 94, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringPct: { color: Colors.text, fontSize: 19, fontWeight: '800' },
  ringSub: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  miniStatLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  miniStatPct: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  barTrackSmall: {
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFillSmall: { height: '100%', borderRadius: 3 },
  quickMetricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 10,
  },
  quickMetric: { flex: 1, alignItems: 'center' },
  qmVal: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  qmLbl: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { color: Colors.text, fontSize: 12, textTransform: 'capitalize', flex: 1 },
  legendPct: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  chartSection: { gap: 8, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, paddingTop: 10 },
  barChartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barCol: { alignItems: 'center', flex: 1, gap: 3 },
  barColVal: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700', height: 14 },
  barColDay: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  excelTable: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  excelRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
  },
  excelRowAlt: { backgroundColor: Colors.bg },
  excelHeader: { backgroundColor: Colors.surfaceElevated },
  excelHeaderText: { fontWeight: '800', color: Colors.text },
  excelCell: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 12,
    color: Colors.textSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.borderSubtle,
  },
  excelBold: { color: Colors.text, fontWeight: '700' },
  colDay: { width: 48 },
  colDate: { width: 64 },
  colWorkout: { width: 130 },
  colNum: { width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] },
  muscleBlock: { gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muscleLabel: { color: Colors.text, fontSize: 13, width: 84, textTransform: 'capitalize' },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.bg,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 5 },
  muscleCount: { color: Colors.text, fontSize: 13, fontWeight: '700', width: 28, textAlign: 'right' },
  drillWrap: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 8,
  },
  drillExCard: { gap: 4 },
  drillExName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  drillDayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  drillDayLabel: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  drillDaySets: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  discGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  discTile: {
    width: '48.5%',
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 2,
  },
  discLabel: { color: Colors.textSecondary, fontSize: 12 },
  discVal: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  photoCard: { alignItems: 'center', gap: 6 },
  photoImg: { width: 112, height: 148, borderRadius: 12, backgroundColor: Colors.bg },
  photoDate: { color: Colors.text, fontSize: 12, fontWeight: '700' },
});
