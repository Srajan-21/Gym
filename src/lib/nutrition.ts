import { Ingredient, OilGheeLevel } from '../types/database';

export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/**
 * Extra oil/ghee added per serving for Mess / Eating Out dishes.
 * - none: exact base macros (0g extra oil)
 * - light: +3g oil/ghee (~27 kcal)
 * - medium: +8g oil/ghee (~72 kcal)
 * - heavy: +15g oil/ghee (~135 kcal)
 */
const EXTRA_OIL_GRAMS: Record<OilGheeLevel, number> = {
  none: 0,
  light: 3,
  medium: 8,
  heavy: 15,
};

/**
 * Calculates macros for a given gram weight of an ingredient,
 * optionally adding extra oil/ghee for mess/restaurant dishes.
 */
export function calculateIngredientMacros(
  ingredient: Ingredient,
  grams: number,
  oilGheeLevel: OilGheeLevel = 'none'
): MacroTotals {
  const factor = Math.max(0, grams) / 100;
  const extraOilGrams = EXTRA_OIL_GRAMS[oilGheeLevel];

  const baseFat = ingredient.fat_per_100g * factor;
  const totalFat = baseFat + extraOilGrams;
  const extraCalories = extraOilGrams * 9;

  return {
    calories: Math.round(ingredient.calories_per_100g * factor + extraCalories),
    protein_g: round1(ingredient.protein_per_100g * factor),
    carbs_g: round1(ingredient.carbs_per_100g * factor),
    fat_g: round1(totalFat),
  };
}

export function sumMacros(items: MacroTotals[]): MacroTotals {
  return items.reduce<MacroTotals>(
    (acc, item) => ({
      calories: Math.round(acc.calories + item.calories),
      protein_g: round1(acc.protein_g + item.protein_g),
      carbs_g: round1(acc.carbs_g + item.carbs_g),
      fat_g: round1(acc.fat_g + item.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
