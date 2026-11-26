import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedDate } from '../context/DateContext';
import { calculateIngredientMacros, MacroTotals, sumMacros } from '../lib/nutrition';
import { getCachedJson, setCachedJson } from '../lib/storage';
import { supabase } from '../lib/supabase';
import {
  FoodLog,
  GoalMode,
  Ingredient,
  MealSlot,
  OilGheeLevel,
  SavedMeal,
  UserGoals,
} from '../types/database';

export interface RecipeDraftItem {
  ingredient: Ingredient;
  quantity: number;
  unit: Ingredient['default_unit'];
  grams: number;
}

const DEFAULT_GOALS: Omit<UserGoals, 'id' | 'user_id' | 'updated_at'> = {
  goal_mode: 'recomp',
  target_calories: 2200,
  target_protein_g: 150,
  target_carbs_g: 220,
  target_fat_g: 65,
  target_water_glasses: 10,
  target_steps: 10000,
};

export function useDiet() {
  const { user } = useAuth();
  const { selectedDate: today } = useSelectedDate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [goals, setGoals] = useState<Omit<UserGoals, 'id' | 'user_id' | 'updated_at'>>(DEFAULT_GOALS);
  const [loading, setLoading] = useState(true);

  const loadDietData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [cachedIngredients, cachedMeals, cachedLogs] = await Promise.all([
      getCachedJson<Ingredient[]>('gym_ingredients_v1'),
      getCachedJson<SavedMeal[]>('gym_saved_meals_v1'),
      getCachedJson<FoodLog[]>(`gym_food_logs_${today}_v1`),
    ]);

    if (cachedIngredients) setIngredients(cachedIngredients);
    if (cachedMeals) setSavedMeals(cachedMeals);
    if (cachedLogs) setFoodLogs(cachedLogs);

    try {
      const [{ data: ingData }, { data: mealData }, { data: logData }, { data: goalData }] =
        await Promise.all([
          supabase.from('ingredients').select('*').order('name'),
          supabase
            .from('saved_meals')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('food_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('log_date', today)
            .order('logged_at', { ascending: false }),
          supabase.from('user_goals').select('*').eq('user_id', user.id).maybeSingle(),
        ]);

      if (ingData) {
        setIngredients(ingData as Ingredient[]);
        setCachedJson('gym_ingredients_v1', ingData);
      }
      if (mealData) {
        setSavedMeals(mealData as SavedMeal[]);
        setCachedJson('gym_saved_meals_v1', mealData);
      }
      if (logData) {
        setFoodLogs(logData as FoodLog[]);
        setCachedJson(`gym_food_logs_${today}_v1`, logData);
      }
      if (goalData) {
        setGoals(goalData as UserGoals);
      }
    } catch {
      // Fallback to cached data when offline
    } finally {
      setLoading(false);
    }
  }, [today, user]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadDietData();
    })();
  }, [loadDietData]);

  const dailyTotals: MacroTotals = useMemo(
    () =>
      sumMacros(
        foodLogs.map((l) => ({
          calories: Number(l.calories),
          protein_g: Number(l.protein_g),
          carbs_g: Number(l.carbs_g),
          fat_g: Number(l.fat_g),
        }))
      ),
    [foodLogs]
  );

  const logFoodEntry = async (params: {
    mealSlot: MealSlot;
    mealName: string;
    oilGheeLevel?: OilGheeLevel;
    macros: MacroTotals;
  }) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('food_logs')
      .insert({
        user_id: user.id,
        log_date: today,
        meal_slot: params.mealSlot,
        meal_name: params.mealName.trim(),
        oil_ghee_level: params.oilGheeLevel ?? 'none',
        calories: params.macros.calories,
        protein_g: params.macros.protein_g,
        carbs_g: params.macros.carbs_g,
        fat_g: params.macros.fat_g,
      })
      .select()
      .single();

    if (error) throw error;
    const next = [data as FoodLog, ...foodLogs];
    setFoodLogs(next);
    setCachedJson(`gym_food_logs_${today}_v1`, next);
  };

  const deleteFoodLog = async (id: string) => {
    const next = foodLogs.filter((l) => l.id !== id);
    setFoodLogs(next);
    setCachedJson(`gym_food_logs_${today}_v1`, next);
    await supabase.from('food_logs').delete().eq('id', id);
  };

  const saveCustomMeal = async (name: string, items: RecipeDraftItem[]) => {
    if (!user || items.length === 0) return null;
    const totals = sumMacros(
      items.map((it) => calculateIngredientMacros(it.ingredient, it.grams, 'none'))
    );

    const { data: meal, error } = await supabase
      .from('saved_meals')
      .insert({
        user_id: user.id,
        name: name.trim(),
        total_calories: totals.calories,
        total_protein: totals.protein_g,
        total_carbs: totals.carbs_g,
        total_fat: totals.fat_g,
      })
      .select()
      .single();

    if (error) throw error;

    const mealItems = items.map((it) => ({
      meal_id: meal.id,
      ingredient_id: it.ingredient.id,
      quantity: it.quantity,
      unit: it.unit,
      grams: it.grams,
    }));
    await supabase.from('saved_meal_items').insert(mealItems);

    const next = [meal as SavedMeal, ...savedMeals];
    setSavedMeals(next);
    setCachedJson('gym_saved_meals_v1', next);
    return meal as SavedMeal;
  };

  const deleteSavedMeal = async (id: string) => {
    const next = savedMeals.filter((m) => m.id !== id);
    setSavedMeals(next);
    setCachedJson('gym_saved_meals_v1', next);
    await supabase.from('saved_meals').delete().eq('id', id);
  };

  const createCustomIngredient = async (params: {
    name: string;
    category: Ingredient['category'];
    defaultUnit: Ingredient['default_unit'];
    unitGrams: number;
    caloriesPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  }) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('ingredients')
      .insert({
        user_id: user.id,
        name: params.name.trim(),
        category: params.category,
        default_unit: params.defaultUnit,
        unit_grams: params.unitGrams,
        calories_per_100g: params.caloriesPer100g,
        protein_per_100g: params.proteinPer100g,
        carbs_per_100g: params.carbsPer100g,
        fat_per_100g: params.fatPer100g,
        is_mess_dish: params.category === 'mess_dish',
      })
      .select()
      .single();

    if (error) throw error;
    const next = [...ingredients, data as Ingredient].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setIngredients(next);
    setCachedJson('gym_ingredients_v1', next);
    return data as Ingredient;
  };

  const updateMacroGoals = async (nextGoals: {
    goal_mode: GoalMode;
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
  }) => {
    if (!user) return;
    setGoals((prev) => ({ ...prev, ...nextGoals }));
    await supabase.from('user_goals').upsert(
      {
        user_id: user.id,
        ...nextGoals,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  };

  return {
    ingredients,
    savedMeals,
    foodLogs,
    goals,
    dailyTotals,
    loading,
    refresh: loadDietData,
    logFoodEntry,
    deleteFoodLog,
    saveCustomMeal,
    deleteSavedMeal,
    createCustomIngredient,
    updateMacroGoals,
  };
}
