import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  Calendar,
  Camera,
  Droplets,
  Dumbbell,
  Footprints,
  LogOut,
  Minus,
  Moon,
  Plus,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useDailyHabits } from '../../hooks/useDailyHabits';
import { useDiet } from '../../hooks/useDiet';
import { FULL_DAY_NAMES, useSplit } from '../../hooks/useSplit';
import { getOptimizedPhotoUrl } from '../../lib/cloudinary';
import { GymAndroidNative } from '../../native/GymAndroidNative';
import { Colors } from '../../theme/colors';
import { PoseTag } from '../../types/database';

const POSE_TAGS: PoseTag[] = ['front', 'side', 'back', 'pump'];

export default function TodayScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const todayIndex = new Date().getDay();
  const { splitsByDay } = useSplit();
  const todaySplit = splitsByDay[todayIndex];

  const { dailyTotals, goals } = useDiet();
  const {
    dailyLog,
    todayPhotos,
    sleepDurationHours,
    uploadingPhoto,
    adjustWater,
    saveSteps,
    saveSleep,
    addProgressPhoto,
  } = useDailyHabits();

  const [bedInput, setBedInput] = useState('23:15');
  const [wakeInput, setWakeInput] = useState('06:45');
  const [treadmillInput, setTreadmillInput] = useState('');
  const [otherStepsInput, setOtherStepsInput] = useState('');
  const [poseTag, setPoseTag] = useState<PoseTag>('front');

  useEffect(() => {
    GymAndroidNative.updateWidgetSnapshot({
      remainingCalories: goals.target_calories - dailyTotals.calories,
      remainingProtein: goals.target_protein_g - dailyTotals.protein_g,
      waterGlasses: dailyLog?.water_glasses ?? 0,
      splitName: todaySplit?.split.split_name ?? "Today's Split",
    });
  }, [
    dailyLog?.water_glasses,
    dailyTotals.calories,
    dailyTotals.protein_g,
    goals.target_calories,
    goals.target_protein_g,
    todaySplit?.split.split_name,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void (async () => {
          const pending = await GymAndroidNative.consumePendingLogs();
          if (pending.waterDelta > 0) {
            await adjustWater(pending.waterDelta);
          }
        })();
      }
    });
    return () => sub.remove();
  }, [adjustWater]);

  const handleWater = async (delta: number) => {
    await adjustWater(delta);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveSleep = async () => {
    try {
      await saveSleep(bedInput.trim(), wakeInput.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Sleep & wake time logged.');
    } catch (err) {
      Alert.alert('Format Error', err instanceof Error ? err.message : 'Invalid time.');
    }
  };

  const handleSaveSteps = async () => {
    const t = parseInt(treadmillInput, 10) || (dailyLog?.steps_treadmill ?? 0);
    const o = parseInt(otherStepsInput, 10) || (dailyLog?.steps_other ?? 0);
    await saveSteps(t, o);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', `Total steps updated: ${t + o}`);
  };

  const handlePickPhoto = async (useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Allow camera/gallery access to upload progress photos.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.75 });

    if (result.canceled || !result.assets[0]) return;

    try {
      await addProgressPhoto(result.assets[0].uri, poseTag);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Cloudinary error.');
    }
  };

  const totalSteps = (dailyLog?.steps_treadmill ?? 0) + (dailyLog?.steps_other ?? 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>{FULL_DAY_NAMES[todayIndex]}</Text>
          <Text style={styles.title}>Today&apos;s Dashboard</Text>
          <Text style={styles.sub}>{user?.email}</Text>
        </View>
        <Pressable style={styles.signOutBtn} onPress={signOut}>
          <LogOut size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Today's Split */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today&apos;s Split</Text>
        <Text style={styles.splitName}>
          {todaySplit?.split.split_name ?? 'No split set for today'}
        </Text>
        <View style={styles.rowGap}>
          <Pressable
            style={[styles.primaryBtn, { flex: 1 }]}
            onPress={() => router.push('/(tabs)/workout')}
          >
            <Dumbbell size={16} color="#fff" />
            <Text style={styles.btnText}>Open Workout</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => router.push('/split-planner')}>
            <Calendar size={16} color={Colors.primary} />
            <Text style={styles.outlineText}>Plan Split</Text>
          </Pressable>
        </View>
      </View>

      {/* Diet Snapshot */}
      <Pressable style={styles.card} onPress={() => router.push('/(tabs)/diet')}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Nutrition Today</Text>
          <Text style={styles.linkText}>Open Diet →</Text>
        </View>
        <Text style={styles.bigVal}>
          {dailyTotals.calories} / {goals.target_calories} kcal
        </Text>
        <Text style={styles.muted}>
          Protein: {dailyTotals.protein_g} / {goals.target_protein_g}g • Carbs:{' '}
          {dailyTotals.carbs_g}g • Fat: {dailyTotals.fat_g}g
        </Text>
      </Pressable>

      {/* Water Intake */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Droplets size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>Water Intake</Text>
          </View>
          <Text style={styles.bigVal}>{dailyLog?.water_glasses ?? 0} glasses</Text>
        </View>
        <View style={styles.rowGap}>
          <Pressable style={styles.waterBtn} onPress={() => handleWater(-1)}>
            <Minus size={16} color={Colors.text} />
            <Text style={styles.waterBtnText}>-1 Glass</Text>
          </Pressable>
          <Pressable
            style={[styles.waterBtn, { backgroundColor: Colors.primarySoft, borderColor: Colors.primary }]}
            onPress={() => handleWater(1)}
          >
            <Plus size={16} color={Colors.primary} />
            <Text style={[styles.waterBtnText, { color: Colors.primary }]}>+1 Glass</Text>
          </Pressable>
        </View>
      </View>

      {/* Sleep & Wake Time */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Moon size={18} color={Colors.purple} />
            <Text style={styles.cardTitle}>Sleep & Wake Time</Text>
          </View>
          {sleepDurationHours !== null && (
            <Text style={[styles.badge, { color: Colors.purple }]}>{sleepDurationHours} hrs</Text>
          )}
        </View>
        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Bed (24h HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={bedInput}
              onChangeText={setBedInput}
              placeholder="23:15"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Wake (24h HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={wakeInput}
              onChangeText={setWakeInput}
              placeholder="06:45"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <Pressable style={styles.saveSmallBtn} onPress={handleSaveSleep}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        </View>
      </View>

      {/* Treadmill & General Steps */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Footprints size={18} color={Colors.success} />
            <Text style={styles.cardTitle}>Steps Tracker</Text>
          </View>
          <Text style={[styles.badge, { color: Colors.success }]}>{totalSteps} total</Text>
        </View>
        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>
              Treadmill ({dailyLog?.steps_treadmill ?? 0})
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={treadmillInput}
              onChangeText={setTreadmillInput}
              placeholder="e.g. 4000"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.miniLabel}>Other ({dailyLog?.steps_other ?? 0})</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={otherStepsInput}
              onChangeText={setOtherStepsInput}
              placeholder="e.g. 5500"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <Pressable style={styles.saveSmallBtn} onPress={handleSaveSteps}>
            <Text style={styles.btnText}>Save</Text>
          </Pressable>
        </View>
      </View>

      {/* Daily Progress Photo (Cloudinary) */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowGapSmall}>
            <Camera size={18} color={Colors.amber} />
            <Text style={styles.cardTitle}>Daily Progress Photo</Text>
          </View>
          {uploadingPhoto && <ActivityIndicator size="small" color={Colors.amber} />}
        </View>

        <View style={styles.rowGap}>
          {POSE_TAGS.map((tag) => (
            <Pressable
              key={tag}
              style={[styles.poseChip, poseTag === tag && styles.poseChipActive]}
              onPress={() => setPoseTag(tag)}
            >
              <Text style={[styles.poseText, poseTag === tag && styles.poseTextActive]}>
                {tag}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rowGap}>
          <Pressable
            style={[styles.outlineBtn, { flex: 1, justifyContent: 'center' }]}
            onPress={() => handlePickPhoto(true)}
            disabled={uploadingPhoto}
          >
            <Camera size={16} color={Colors.primary} />
            <Text style={styles.outlineText}>Take Photo</Text>
          </Pressable>
          <Pressable
            style={[styles.outlineBtn, { flex: 1, justifyContent: 'center' }]}
            onPress={() => handlePickPhoto(false)}
            disabled={uploadingPhoto}
          >
            <Text style={styles.outlineText}>Gallery</Text>
          </Pressable>
        </View>

        {todayPhotos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {todayPhotos.map((p) => (
              <View key={p.id} style={styles.thumbWrap}>
                <Image
                  source={{ uri: getOptimizedPhotoUrl(p.cloudinary_url, 400) }}
                  style={styles.thumb}
                />
                <Text style={styles.thumbTag}>{p.pose_tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: Colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700' },
  sub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  signOutBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  splitName: { color: Colors.text, fontSize: 19, fontWeight: '700' },
  bigVal: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  badge: { fontSize: 13, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 13 },
  linkText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outlineText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  waterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  waterBtnText: { color: Colors.text, fontWeight: '600', fontSize: 13 },
  miniLabel: { color: Colors.textSecondary, fontSize: 11, marginBottom: 4 },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  saveSmallBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  poseChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  poseChipActive: { backgroundColor: Colors.amberSoft, borderColor: Colors.amber },
  poseText: { color: Colors.textSecondary, fontSize: 12, textTransform: 'capitalize' },
  poseTextActive: { color: Colors.amber, fontWeight: '700' },
  thumbWrap: { alignItems: 'center', gap: 4 },
  thumb: { width: 84, height: 110, borderRadius: 10, backgroundColor: Colors.bg },
  thumbTag: { color: Colors.textSecondary, fontSize: 11, textTransform: 'capitalize' },
});
