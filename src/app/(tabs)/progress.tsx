import React, { useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BarChart3, CalendarCheck, Camera } from 'lucide-react-native';
import { PhotoLightboxModal } from '../../components/PhotoLightboxModal';
import { useWeeklyProgress } from '../../hooks/useWeeklyProgress';
import { getOptimizedPhotoUrl } from '../../lib/cloudinary';
import { Colors } from '../../theme/colors';
import { ProgressPhoto } from '../../types/database';

export default function ProgressScreen() {
  const { summary, muscleVolume, photos, loading, refresh } = useWeeklyProgress();
  const [compareLeftIdx, setCompareLeftIdx] = useState(0);
  const [compareRightIdx, setCompareRightIdx] = useState(1);
  const [enlargedPhoto, setEnlargedPhoto] = useState<ProgressPhoto | null>(null);

  const maxMuscleSets = Math.max(1, ...muscleVolume.map((m) => m.sets));

  const formatDelta = (delta: number | null) => {
    if (delta === null) return '—';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta} kg vs last wk`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
    >
      {/* Weekly Check-in Summary */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <CalendarCheck size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Weekly Check-in Summary (7-Day Avg)</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Avg Weight</Text>
            <Text style={styles.statValue}>
              {summary.avgWeightKg !== null ? `${summary.avgWeightKg} kg` : '—'}
            </Text>
            <Text style={styles.statHint}>{formatDelta(summary.weightDeltaKg)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Workouts Done</Text>
            <Text style={styles.statValue}>{summary.workoutsCompleted}</Text>
            <Text style={styles.statHint}>Last 7 days</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Avg Calories</Text>
            <Text style={styles.statValue}>{summary.avgCalories} kcal</Text>
            <Text style={styles.statHint}>Avg Protein: {summary.avgProteinG}g</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Avg Sleep & Steps</Text>
            <Text style={styles.statValue}>
              {summary.avgSleepHours !== null ? `${summary.avgSleepHours}h` : '—'}
            </Text>
            <Text style={styles.statHint}>{summary.avgSteps} steps/day</Text>
          </View>
        </View>
      </View>

      {/* Weekly Muscle Volume Counter */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <BarChart3 size={18} color={Colors.success} />
          <Text style={styles.cardTitle}>Weekly Muscle Volume (Working Sets)</Text>
        </View>

        {muscleVolume.length === 0 ? (
          <Text style={styles.emptyText}>
            Log working sets in the Workout tab to see your weekly sets per muscle group (warm-up
            sets are excluded).
          </Text>
        ) : (
          muscleVolume.map((item) => {
            const widthPct = `${Math.round((item.sets / maxMuscleSets) * 100)}%` as const;
            return (
              <View key={item.muscle} style={styles.barRow}>
                <Text style={styles.muscleLabel}>{item.muscle}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: widthPct }]} />
                </View>
                <Text style={styles.muscleCount}>{item.sets}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Side-by-Side Cloudinary Photo Compare */}
      <View style={styles.card}>
        <View style={styles.rowGapSmall}>
          <Camera size={18} color={Colors.amber} />
          <Text style={styles.cardTitle}>Progress Photos (Cloudinary)</Text>
        </View>

        {photos.length === 0 ? (
          <Text style={styles.emptyText}>
            Upload daily physique photos on the Today tab to track visual progress over time.
          </Text>
        ) : (
          <>
            {photos.length >= 2 && (
              <View style={styles.compareRow}>
                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>
                    {photos[compareLeftIdx]?.log_date} ({photos[compareLeftIdx]?.pose_tag})
                  </Text>
                  <Pressable
                    onPress={() => photos[compareLeftIdx] && setEnlargedPhoto(photos[compareLeftIdx])}
                  >
                    <Image
                      source={{
                        uri: getOptimizedPhotoUrl(photos[compareLeftIdx]?.cloudinary_url ?? '', 500),
                      }}
                      style={styles.compareImg}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.cycleBtn}
                    onPress={() => setCompareLeftIdx((i) => (i + 1) % photos.length)}
                  >
                    <Text style={styles.cycleText}>Next Left</Text>
                  </Pressable>
                </View>

                <View style={styles.compareCol}>
                  <Text style={styles.compareLabel}>
                    {photos[compareRightIdx]?.log_date} ({photos[compareRightIdx]?.pose_tag})
                  </Text>
                  <Pressable
                    onPress={() => photos[compareRightIdx] && setEnlargedPhoto(photos[compareRightIdx])}
                  >
                    <Image
                      source={{
                        uri: getOptimizedPhotoUrl(photos[compareRightIdx]?.cloudinary_url ?? '', 500),
                      }}
                      style={styles.compareImg}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.cycleBtn}
                    onPress={() => setCompareRightIdx((i) => (i + 1) % photos.length)}
                  >
                    <Text style={styles.cycleText}>Next Right</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {photos.map((p) => (
                <Pressable key={p.id} style={styles.timelineItem} onPress={() => setEnlargedPhoto(p)}>
                  <Image
                    source={{ uri: getOptimizedPhotoUrl(p.cloudinary_url, 320) }}
                    style={styles.timelineImg}
                  />
                  <Text style={styles.timelineMeta}>
                    {p.log_date} • {p.pose_tag}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      <PhotoLightboxModal photo={enlargedPhoto} onClose={() => setEnlargedPhoto(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    width: '48%',
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  statLabel: { color: Colors.textSecondary, fontSize: 12 },
  statValue: { color: Colors.text, fontSize: 19, fontWeight: '700' },
  statHint: { color: Colors.textMuted, fontSize: 11 },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muscleLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    width: 82,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.bg,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: Colors.success, borderRadius: 5 },
  muscleCount: { color: Colors.text, fontWeight: '700', fontSize: 13, width: 26, textAlign: 'right' },
  compareRow: { flexDirection: 'row', gap: 10 },
  compareCol: { flex: 1, gap: 6 },
  compareLabel: { color: Colors.textSecondary, fontSize: 11, textTransform: 'capitalize' },
  compareImg: { width: '100%', height: 190, borderRadius: 12, backgroundColor: Colors.bg },
  cycleBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cycleText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  timelineItem: { alignItems: 'center', gap: 4 },
  timelineImg: { width: 88, height: 115, borderRadius: 10, backgroundColor: Colors.bg },
  timelineMeta: { color: Colors.textSecondary, fontSize: 10, textTransform: 'capitalize' },
});
