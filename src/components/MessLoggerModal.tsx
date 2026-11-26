import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Flame, X } from 'lucide-react-native';
import { calculateIngredientMacros, MacroTotals } from '../lib/nutrition';
import { Colors } from '../theme/colors';
import { Ingredient, MealSlot, OilGheeLevel } from '../types/database';

interface Props {
  visible: boolean;
  mealSlot: MealSlot;
  ingredients: Ingredient[];
  onClose: () => void;
  onLogMessMeal: (
    mealName: string,
    oilGheeLevel: OilGheeLevel,
    macros: MacroTotals
  ) => Promise<void>;
}

const OIL_LEVELS: { level: OilGheeLevel; label: string; desc: string }[] = [
  { level: 'none', label: 'None', desc: 'Dry / Zero added oil' },
  { level: 'light', label: 'Light', desc: '+3g oil/ghee' },
  { level: 'medium', label: 'Medium', desc: '+8g oil/ghee' },
  { level: 'heavy', label: 'Heavy', desc: '+15g restaurant ghee' },
];

export function MessLoggerModal({
  visible,
  mealSlot,
  ingredients,
  onClose,
  onLogMessMeal,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedDish, setSelectedDish] = useState<Ingredient | null>(null);
  const [servings, setServings] = useState('1');
  const [oilLevel, setOilLevel] = useState<OilGheeLevel>('medium');

  const messDishes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...ingredients]
      .sort((a, b) => Number(b.is_mess_dish) - Number(a.is_mess_dish))
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .slice(0, 25);
  }, [ingredients, search]);

  const previewMacros = useMemo(() => {
    if (!selectedDish) return null;
    const count = Math.max(0.25, parseFloat(servings) || 1);
    const grams = count * selectedDish.unit_grams;
    return calculateIngredientMacros(selectedDish, grams, oilLevel);
  }, [oilLevel, selectedDish, servings]);

  const handleLog = async () => {
    if (!selectedDish || !previewMacros) return;
    const count = Math.max(0.25, parseFloat(servings) || 1);
    const label = `${selectedDish.name} (${count} ${selectedDish.default_unit})`;
    await onLogMessMeal(label, oilLevel, previewMacros);
    setSelectedDish(null);
    setServings('1');
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.title}>Mess / Eating Out Logger</Text>
              <Text style={styles.sub}>Slot: {mealSlot.replace('_', ' ')}</Text>
            </View>
            <Pressable onPress={onClose}>
              <X size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {selectedDish && previewMacros ? (
            <View style={{ gap: 14 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.dishTitle}>{selectedDish.name}</Text>
                <Pressable onPress={() => setSelectedDish(null)}>
                  <Text style={styles.linkText}>Change Dish</Text>
                </Pressable>
              </View>

              <View>
                <Text style={styles.label}>
                  Servings ({selectedDish.default_unit} ≈ {selectedDish.unit_grams}g each)
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={servings}
                  onChangeText={setServings}
                />
              </View>

              {/* Oil & Ghee Slider */}
              <View style={styles.sliderBox}>
                <View style={styles.rowGap}>
                  <Flame size={16} color={Colors.amber} />
                  <Text style={styles.label}>Oil & Ghee Slider</Text>
                </View>
                <View style={styles.sliderTrack}>
                  {OIL_LEVELS.map((item) => {
                    const active = oilLevel === item.level;
                    return (
                      <Pressable
                        key={item.level}
                        style={[styles.sliderStop, active && styles.sliderStopActive]}
                        onPress={() => setOilLevel(item.level)}
                      >
                        <Text style={[styles.stopLabel, active && styles.stopLabelActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.hintText}>
                  {OIL_LEVELS.find((l) => l.level === oilLevel)?.desc}
                </Text>
              </View>

              <View style={styles.previewCard}>
                <Text style={styles.previewCal}>{previewMacros.calories} kcal</Text>
                <Text style={styles.previewMacros}>
                  Protein: {previewMacros.protein_g}g • Carbs: {previewMacros.carbs_g}g • Fat:{' '}
                  {previewMacros.fat_g}g
                </Text>
              </View>

              <Pressable style={styles.primaryBtn} onPress={handleLog}>
                <Text style={styles.primaryBtnText}>Log Mess Meal</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TextInput
                style={styles.input}
                placeholder="Search Dal Makhani, Tandoori Roti, Biryani..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
              <ScrollView style={{ maxHeight: 380 }}>
                {messDishes.map((dish) => (
                  <Pressable
                    key={dish.id}
                    style={styles.dishRow}
                    onPress={() => {
                      setSelectedDish(dish);
                      setOilLevel(dish.is_mess_dish ? 'medium' : 'light');
                    }}
                  >
                    <View>
                      <Text style={styles.dishName}>{dish.name}</Text>
                      <Text style={styles.dishMeta}>
                        1 {dish.default_unit} ({dish.unit_grams}g) • Base{' '}
                        {Math.round((dish.calories_per_100g * dish.unit_grams) / 100)} kcal
                      </Text>
                    </View>
                    {dish.is_mess_dish && <Text style={styles.messBadge}>Mess</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: Colors.amber, fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  dishTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  linkText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
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
  sliderBox: {
    backgroundColor: Colors.surfaceElevated,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  sliderTrack: { flexDirection: 'row', gap: 6 },
  sliderStop: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  sliderStopActive: {
    backgroundColor: Colors.amberSoft,
    borderColor: Colors.amber,
  },
  stopLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  stopLabelActive: { color: Colors.amber, fontWeight: '700' },
  hintText: { color: Colors.textMuted, fontSize: 12 },
  previewCard: {
    backgroundColor: Colors.primarySoft,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  previewCal: { color: Colors.primary, fontSize: 22, fontWeight: '700' },
  previewMacros: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dishName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  dishMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  messBadge: {
    color: Colors.amber,
    backgroundColor: Colors.amberSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '700',
  },
});
