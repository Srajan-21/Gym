import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Bookmark, Calculator, Flame, Settings, Trash2, X } from 'lucide-react-native';
import { DateStrip } from '../../components/DateStrip';
import { MessLoggerModal } from '../../components/MessLoggerModal';
import { RecipeBuilderModal } from '../../components/RecipeBuilderModal';
import { useDiet } from '../../hooks/useDiet';
import { Colors } from '../../theme/colors';
import { GoalMode, MealSlot } from '../../types/database';

const MEAL_SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'pre_workout', label: 'Pre-Workout' },
  { key: 'post_workout', label: 'Post-Workout' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
];

const GOAL_MODES: GoalMode[] = ['cut', 'recomp', 'maintain', 'bulk'];

export default function DietScreen() {
  const {
    ingredients,
    savedMeals,
    foodLogs,
    goals,
    dailyTotals,
    logFoodEntry,
    deleteFoodLog,
    saveCustomMeal,
    deleteSavedMeal,
    createCustomIngredient,
    updateMacroGoals,
  } = useDiet();

  const [activeSlot, setActiveSlot] = useState<MealSlot>('lunch');
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [messOpen, setMessOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const [goalMode, setGoalMode] = useState<GoalMode>(goals.goal_mode);
  const [calTarget, setCalTarget] = useState(String(goals.target_calories));
  const [proTarget, setProTarget] = useState(String(goals.target_protein_g));
  const [carbTarget, setCarbTarget] = useState(String(goals.target_carbs_g));
  const [fatTarget, setFatTarget] = useState(String(goals.target_fat_g));

  const openGoalsModal = () => {
    setGoalMode(goals.goal_mode);
    setCalTarget(String(goals.target_calories));
    setProTarget(String(goals.target_protein_g));
    setCarbTarget(String(goals.target_carbs_g));
    setFatTarget(String(goals.target_fat_g));
    setGoalsOpen(true);
  };

  const handleSaveGoals = async () => {
    await updateMacroGoals({
      goal_mode: goalMode,
      target_calories: parseInt(calTarget, 10) || 2200,
      target_protein_g: parseInt(proTarget, 10) || 150,
      target_carbs_g: parseInt(carbTarget, 10) || 220,
      target_fat_g: parseInt(fatTarget, 10) || 65,
    });
    setGoalsOpen(false);
  };

  const pct = (val: number, max: number) => `${Math.min(100, Math.round((val / Math.max(1, max)) * 100))}%` as const;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DateStrip />

      {/* Macro Progress Card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.kicker}>{goals.goal_mode.toUpperCase()} MODE</Text>
            <Text style={styles.calHeadline}>
              {dailyTotals.calories}{' '}
              <Text style={styles.calTarget}>/ {goals.target_calories} kcal</Text>
            </Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={openGoalsModal}>
            <Settings size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.barBg}>
          <View
            style={[
              styles.barFill,
              { width: pct(dailyTotals.calories, goals.target_calories), backgroundColor: Colors.primary },
            ]}
          />
        </View>

        <View style={styles.macroRow}>
          <View style={styles.macroCol}>
            <Text style={styles.macroLabel}>Protein</Text>
            <Text style={styles.macroVal}>
              {dailyTotals.protein_g} / {goals.target_protein_g}g
            </Text>
            <View style={styles.barBgSmall}>
              <View
                style={[
                  styles.barFill,
                  { width: pct(dailyTotals.protein_g, goals.target_protein_g), backgroundColor: Colors.success },
                ]}
              />
            </View>
          </View>
          <View style={styles.macroCol}>
            <Text style={styles.macroLabel}>Carbs</Text>
            <Text style={styles.macroVal}>
              {dailyTotals.carbs_g} / {goals.target_carbs_g}g
            </Text>
            <View style={styles.barBgSmall}>
              <View
                style={[
                  styles.barFill,
                  { width: pct(dailyTotals.carbs_g, goals.target_carbs_g), backgroundColor: Colors.amber },
                ]}
              />
            </View>
          </View>
          <View style={styles.macroCol}>
            <Text style={styles.macroLabel}>Fat</Text>
            <Text style={styles.macroVal}>
              {dailyTotals.fat_g} / {goals.target_fat_g}g
            </Text>
            <View style={styles.barBgSmall}>
              <View
                style={[
                  styles.barFill,
                  { width: pct(dailyTotals.fat_g, goals.target_fat_g), backgroundColor: Colors.purple },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Meal Slot Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {MEAL_SLOTS.map((slot) => {
          const active = activeSlot === slot.key;
          return (
            <Pressable
              key={slot.key}
              style={[styles.slotPill, active && styles.slotPillActive]}
              onPress={() => setActiveSlot(slot.key)}
            >
              <Text style={[styles.slotText, active && styles.slotTextActive]}>{slot.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Action Buttons: Ingredient/Oil Calc & Mess Oil Slider */}
      <View style={styles.rowGap}>
        <Pressable style={[styles.actionBtn, { backgroundColor: Colors.primary }]} onPress={() => setRecipeOpen(true)}>
          <Calculator size={17} color={Colors.primaryText} />
          <Text style={[styles.actionText, { color: Colors.primaryText }]}>Ingredient & Oil Calc</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.amber }]} onPress={() => setMessOpen(true)}>
          <Flame size={17} color={Colors.amber} />
          <Text style={[styles.actionText, { color: Colors.amber }]}>Mess / Oil Slider</Text>
        </Pressable>
      </View>

      {/* 1-Tap Saved Indian Meals */}
      {savedMeals.length > 0 && (
        <View style={styles.card}>
          <View style={styles.rowGapSmall}>
            <Bookmark size={15} color={Colors.primary} />
            <Text style={styles.cardTitle}>My Saved Meals (1-Tap Log)</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {savedMeals.map((meal) => (
              <View key={meal.id} style={styles.savedChip}>
                <Pressable
                  onPress={async () => {
                    await logFoodEntry({
                      mealSlot: activeSlot,
                      mealName: meal.name,
                      macros: {
                        calories: Number(meal.total_calories),
                        protein_g: Number(meal.total_protein),
                        carbs_g: Number(meal.total_carbs),
                        fat_g: Number(meal.total_fat),
                      },
                    });
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={styles.savedName}>{meal.name}</Text>
                  <Text style={styles.savedMeta}>
                    {Math.round(meal.total_calories)} kcal • {meal.total_protein}g P
                  </Text>
                </Pressable>
                <Pressable onPress={() => deleteSavedMeal(meal.id)}>
                  <X size={14} color={Colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Today's Food Log */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today&apos;s Food Log</Text>
        {foodLogs.length === 0 ? (
          <Text style={styles.emptyText}>
            No meals logged yet today. Use Ingredient & Oil Calc or Mess / Oil Slider above.
          </Text>
        ) : (
          foodLogs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logName}>{log.meal_name}</Text>
                <Text style={styles.logMeta}>
                  {log.meal_slot.replace('_', ' ')} • {Math.round(log.calories)} kcal • P{' '}
                  {log.protein_g}g • C {log.carbs_g}g • F {log.fat_g}g
                  {log.oil_ghee_level !== 'none' ? ` • Oil: ${log.oil_ghee_level}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => deleteFoodLog(log.id)}>
                <Trash2 size={16} color={Colors.danger} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <RecipeBuilderModal
        visible={recipeOpen}
        mealSlot={activeSlot}
        ingredients={ingredients}
        onClose={() => setRecipeOpen(false)}
        onLogMeal={async (mealName, macros) => {
          await logFoodEntry({ mealSlot: activeSlot, mealName, macros });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        onSaveAndLogMeal={async (mealName, items, macros) => {
          await saveCustomMeal(mealName, items);
          await logFoodEntry({ mealSlot: activeSlot, mealName, macros });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        onCreateIngredient={createCustomIngredient}
      />

      <MessLoggerModal
        visible={messOpen}
        mealSlot={activeSlot}
        ingredients={ingredients}
        onClose={() => setMessOpen(false)}
        onLogMessMeal={async (mealName, oilGheeLevel, macros) => {
          await logFoodEntry({ mealSlot: activeSlot, mealName, oilGheeLevel, macros });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      {/* Macro Targets Modal */}
      <Modal visible={goalsOpen} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Daily Macro Targets</Text>
              <Pressable onPress={() => setGoalsOpen(false)}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.rowGap}>
              {GOAL_MODES.map((m) => (
                <Pressable
                  key={m}
                  style={[styles.slotPill, goalMode === m && styles.slotPillActive]}
                  onPress={() => setGoalMode(m)}
                >
                  <Text style={[styles.slotText, goalMode === m && styles.slotTextActive]}>
                    {m.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroLabel}>Calories</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={calTarget} onChangeText={setCalTarget} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroLabel}>Protein (g)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={proTarget} onChangeText={setProTarget} />
              </View>
            </View>
            <View style={styles.rowGap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroLabel}>Carbs (g)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={carbTarget} onChangeText={setCarbTarget} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.macroLabel}>Fat (g)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" value={fatTarget} onChangeText={setFatTarget} />
              </View>
            </View>
            <Pressable style={styles.saveGoalsBtn} onPress={handleSaveGoals}>
              <Text style={[styles.actionText, { color: Colors.primaryText }]}>Save Targets</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 10 },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { color: Colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  calHeadline: { color: Colors.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  calTarget: { color: Colors.textSecondary, fontSize: 15, fontWeight: '500' },
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  barBg: { height: 8, backgroundColor: Colors.bg, borderRadius: 4, overflow: 'hidden' },
  barBgSmall: { height: 6, backgroundColor: Colors.bg, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 4 },
  macroRow: { flexDirection: 'row', gap: 12 },
  macroCol: { flex: 1 },
  macroLabel: { color: Colors.textSecondary, fontSize: 12 },
  macroVal: { color: Colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  slotPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotPillActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  slotText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  slotTextActive: { color: Colors.primary },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  savedName: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  savedMeta: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  logMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveGoalsBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
});
