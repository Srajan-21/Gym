export type GoalMode = 'cut' | 'maintain' | 'bulk' | 'recomp';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'cardio';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'other';

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';
export type EffortLevel = 'easy' | 'moderate' | 'hard' | 'failure';
export type ExerciseStatus = 'pending' | 'in_progress' | 'completed';
export type PoseTag = 'front' | 'side' | 'back' | 'pump';
export type MealSlot =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'pre_workout'
  | 'post_workout'
  | 'snack';
export type OilGheeLevel = 'none' | 'light' | 'medium' | 'heavy';

export interface UserGoals {
  id: string;
  user_id: string;
  goal_mode: GoalMode;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  target_water_glasses: number;
  target_steps: number;
  updated_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  weight_pre_kg: number | null;
  weight_post_kg: number | null;
  water_glasses: number;
  steps_treadmill: number;
  steps_other: number;
  sleep_time: string | null;
  wake_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressPhoto {
  id: string;
  user_id: string;
  log_date: string;
  cloudinary_url: string;
  cloudinary_public_id: string;
  pose_tag: PoseTag;
  created_at: string;
}

export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  primary_muscle: MuscleGroup;
  secondary_muscle: string | null;
  equipment: EquipmentType;
  created_at: string;
}

export interface WeeklySplit {
  id: string;
  user_id: string;
  day_of_week: number; // 0 = Sun .. 6 = Sat
  split_name: string;
  is_rest_day: boolean;
}

export interface SplitExercise {
  id: string;
  split_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_rep_range: string;
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  log_date: string;
  split_name: string | null;
  status: 'in_progress' | 'completed';
  started_at: string;
  completed_at: string | null;
}

export interface WorkoutSessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  order_index: number;
  status: ExerciseStatus;
  exercise?: Exercise;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  set_type: SetType;
  effort: EffortLevel;
  logged_at: string;
}

export interface Ingredient {
  id: string;
  user_id: string | null;
  name: string;
  category:
    | 'grain'
    | 'dal_legume'
    | 'dairy'
    | 'oil_ghee'
    | 'protein'
    | 'vegetable'
    | 'fruit'
    | 'nut_seed'
    | 'supplement'
    | 'mess_dish';
  default_unit: 'g' | 'ml' | 'tbsp' | 'tsp' | 'roti' | 'katori' | 'piece' | 'scoop';
  unit_grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  is_mess_dish: boolean;
  created_at: string;
}

export interface SavedMeal {
  id: string;
  user_id: string;
  name: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  log_date: string;
  meal_slot: MealSlot;
  meal_name: string;
  oil_ghee_level: OilGheeLevel;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}
