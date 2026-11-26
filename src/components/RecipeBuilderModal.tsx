import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Plus, Save, Trash2, X } from 'lucide-react-native';
import { RecipeDraftItem } from '../hooks/useDiet';
import { calculateIngredientMacros, MacroTotals, sumMacros } from '../lib/nutrition';
import { Colors } from '../theme/colors';
import { Ingredient, MealSlot } from '../types/database';

interface Props {
  visible: boolean;
  mealSlot: MealSlot;
  ingredients: Ingredient[];
  onClose: () => void;
  onLogMeal: (mealName: string, macros: MacroTotals) => Promise<void>;
  onSaveAndLogMeal: (
    mealName: string,
    items: RecipeDraftItem[],
    macros: MacroTotals
  ) => Promise<void>;
  onCreateIngredient: (params: {
    name: string;
    category: Ingredient['category'];
    defaultUnit: Ingredient['default_unit'];
    unitGrams: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  }) => Promise<Ingredient | null>;
}

export function RecipeBuilderModal({
  visible,
  mealSlot,
  ingredients,
  onClose,
  onLogMeal,
  onSaveAndLogMeal,
  onCreateIngredient,
}: Props) {
  const [mealName, setMealName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [qtyInput, setQtyInput] = useState('100');
  const [useGrams, setUseGrams] = useState(true);
  const [items, setItems] = useState<RecipeDraftItem[]>([]);

  const [customOpen, setCustomOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cCal, setCCal] = useState('');
  const [cPro, setCPro] = useState('');
  const [cCarb, setCCarb] = useState('');
  const [cFat, setCFat] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients
      .filter((i) => !i.is_mess_dish)
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .slice(0, 25);
  }, [ingredients, search]);

  const totals = useMemo(
    () => sumMacros(items.map((it) => calculateIngredientMacros(it.ingredient, it.grams, 'none'))),
    [items]
  );

  const handleSelectIngredient = (ing: Ingredient) => {
    setSelectedIngredient(ing);
    const defaultIsGrams = ing.default_unit === 'g' || ing.default_unit === 'ml';
    setUseGrams(defaultIsGrams);
    setQtyInput(defaultIsGrams ? '100' : '1');
  };

  const handleAddItem = () => {
    if (!selectedIngredient) return;
    const qty = parseFloat(qtyInput) || 0;
    if (qty <= 0) return;

    const grams = useGrams ? qty : qty * selectedIngredient.unit_grams;
    const unit = useGrams
      ? selectedIngredient.default_unit === 'ml'
        ? 'ml'
        : 'g'
      : selectedIngredient.default_unit;

    setItems((prev) => [
      ...prev,
      { ingredient: selectedIngredient, quantity: qty, unit, grams },
    ]);
    setSelectedIngredient(null);
    setSearch('');
  };

  const handleCreateCustom = async () => {
    if (!cName.trim()) {
      Alert.alert('Name required', 'Enter an ingredient name.');
      return;
    }
    const created = await onCreateIngredient({
      name: cName,
      category: 'protein',
      defaultUnit: 'g',
      unitGrams: 100,
      caloriesPer100g: parseFloat(cCal) || 0,
      proteinPer100g: parseFloat(cPro) || 0,
      carbsPer100g: parseFloat(cCarb) || 0,
      fatPer100g: parseFloat(cFat) || 0,
    });
    if (created) {
      handleSelectIngredient(created);
      setCName('');
      setCCal('');
      setCPro('');
      setCCarb('');
      setCFat('');
      setCustomOpen(false);
    }
  };

  const resetAndClose = () => {
    setItems([]);
    setMealName('');
    setSelectedIngredient(null);
    setSearch('');
    onClose();
  };

  const handleLogOnly = async () => {
    if (items.length === 0) return;
    const finalName =
      mealName.trim() || items.map((i) => i.ingredient.name.split('(')[0].trim()).join(' + ');
    await onLogMeal(finalName, totals);
    resetAndClose();
  };

  const handleSaveAndLog = async () => {
    if (items.length === 0) return;
    if (!mealName.trim()) {
      Alert.alert('Meal Name Required', 'Give this recipe a name to save it for 1-tap reuse.');
      return;
    }
    await onSaveAndLogMeal(mealName.trim(), items, totals);
    resetAndClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.title}>Ingredient & Oil Calculator</Text>
              <Text style={styles.sub}>Logging to: {mealSlot.replace('_', ' ')}</Text>
            </View>
            <Pressable onPress={resetAndClose}>
              <X size={22} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ gap: 12 }}>
            <TextInput
              style={styles.input}
              placeholder="Meal Name (e.g. Paneer Bhurji + 1 tbsp Oil)"
              placeholderTextColor={Colors.textMuted}
              value={mealName}
              onChangeText={setMealName}
            />

            {/* Live Totals Banner */}
            <View style={styles.totalsBanner}>
              <Text style={styles.totalCal}>{totals.calories} kcal</Text>
              <Text style={styles.totalMacros}>
                P: {totals.protein_g}g • C: {totals.carbs_g}g • F: {totals.fat_g}g
              </Text>
            </View>

            {/* Draft Ingredients List */}
            {items.map((it, idx) => {
              const m = calculateIngredientMacros(it.ingredient, it.grams, 'none');
              return (
                <View key={`${it.ingredient.id}-${idx}`} style={styles.draftRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.ingredient.name}</Text>
                    <Text style={styles.itemMeta}>
                      {it.quantity} {it.unit} ({Math.round(it.grams)}g) → {m.calories} kcal | P{' '}
                      {m.protein_g}g
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={16} color={Colors.danger} />
                  </Pressable>
                </View>
              );
            })}

            {/* Selected Ingredient Quantity Picker */}
            {selectedIngredient ? (
              <View style={styles.selectedBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemName}>{selectedIngredient.name}</Text>
                  <Pressable onPress={() => setSelectedIngredient(null)}>
                    <Text style={styles.linkText}>Change</Text>
                  </Pressable>
                </View>

                <View style={styles.rowGap}>
                  <Pressable
                    style={[styles.unitChip, !useGrams && styles.unitChipActive]}
                    onPress={() => {
                      setUseGrams(false);
                      setQtyInput('1');
                    }}
                  >
                    <Text style={[styles.unitText, !useGrams && styles.unitTextActive]}>
                      {selectedIngredient.default_unit} ({selectedIngredient.unit_grams}g)
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitChip, useGrams && styles.unitChipActive]}
                    onPress={() => {
                      setUseGrams(true);
                      setQtyInput('100');
                    }}
                  >
                    <Text style={[styles.unitText, useGrams && styles.unitTextActive]}>
                      g / ml
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.rowGap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    keyboardType="decimal-pad"
                    value={qtyInput}
                    onChangeText={setQtyInput}
                    placeholder="Quantity"
                    placeholderTextColor={Colors.textMuted}
                  />
                  <Pressable style={styles.addBtn} onPress={handleAddItem}>
                    <Plus size={16} color="#fff" />
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.searchBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Add Ingredient (Oil, Paneer, Atta, Eggs...)</Text>
                  <Pressable onPress={() => setCustomOpen((v) => !v)}>
                    <Text style={styles.linkText}>+ Custom</Text>
                  </Pressable>
                </View>

                {customOpen && (
                  <View style={styles.customBox}>
                    <TextInput
                      style={styles.input}
                      placeholder="Ingredient Name"
                      placeholderTextColor={Colors.textMuted}
                      value={cName}
                      onChangeText={setCName}
                    />
                    <View style={styles.rowGap}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Kcal/100g"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        value={cCal}
                        onChangeText={setCCal}
                      />
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Prot/100g"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        value={cPro}
                        onChangeText={setCPro}
                      />
                    </View>
                    <View style={styles.rowGap}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Carb/100g"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        value={cCarb}
                        onChangeText={setCCarb}
                      />
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Fat/100g"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        value={cFat}
                        onChangeText={setCFat}
                      />
                    </View>
                    <Pressable style={styles.primaryBtn} onPress={handleCreateCustom}>
                      <Text style={styles.primaryBtnText}>Save Custom Ingredient</Text>
                    </Pressable>
                  </View>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Search Indian staples (mustard oil, paneer, soya, roti...)"
                  placeholderTextColor={Colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                />
                {filtered.map((ing) => (
                  <Pressable
                    key={ing.id}
                    style={styles.ingRow}
                    onPress={() => handleSelectIngredient(ing)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{ing.name}</Text>
                      <Text style={styles.itemMeta}>
                        {ing.calories_per_100g} kcal/100g • P {ing.protein_per_100g}g • F{' '}
                        {ing.fat_per_100g}g
                      </Text>
                    </View>
                    <Plus size={18} color={Colors.primary} />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          {items.length > 0 && (
            <View style={styles.rowGap}>
              <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={handleSaveAndLog}>
                <Save size={16} color={Colors.primary} />
                <Text style={styles.secondaryBtnText}>Save & Log</Text>
              </Pressable>
              <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={handleLogOnly}>
                <Text style={styles.primaryBtnText}>Log Meal</Text>
              </Pressable>
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
    maxHeight: '90%',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: Colors.primary, fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  linkText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
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
  totalsBanner: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalCal: { color: Colors.primary, fontSize: 17, fontWeight: '700' },
  totalMacros: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  itemMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  selectedBox: {
    backgroundColor: Colors.surfaceElevated,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  unitText: { color: Colors.textSecondary, fontSize: 12 },
  unitTextActive: { color: Colors.primary, fontWeight: '700' },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchBox: { gap: 8 },
  customBox: {
    backgroundColor: Colors.surfaceElevated,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});
