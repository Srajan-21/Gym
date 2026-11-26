-- seed.sql
-- Pre-seeded Exercises & IFCT/NIN Indian Ingredients + Common Mess Dishes

-- 1. Core Gym Exercises
insert into public.exercises (user_id, name, primary_muscle, secondary_muscle, equipment) values
  (null, 'Pec Deck Fly', 'chest', 'shoulders', 'machine'),
  (null, 'Incline Dumbbell Press', 'chest', 'triceps', 'dumbbell'),
  (null, 'Flat Barbell Bench Press', 'chest', 'triceps', 'barbell'),
  (null, 'Cable Chest Fly', 'chest', null, 'cable'),
  (null, 'Lat Pulldown', 'back', 'biceps', 'cable'),
  (null, 'Seated Cable Row', 'back', 'biceps', 'cable'),
  (null, 'Barbell Bent-Over Row', 'back', 'biceps', 'barbell'),
  (null, 'Pull-Ups', 'back', 'biceps', 'bodyweight'),
  (null, 'Overhead Dumbbell Press', 'shoulders', 'triceps', 'dumbbell'),
  (null, 'Lateral Raise', 'shoulders', null, 'dumbbell'),
  (null, 'Face Pull', 'shoulders', 'back', 'cable'),
  (null, 'Barbell Curl', 'biceps', null, 'barbell'),
  (null, 'Incline Dumbbell Curl', 'biceps', null, 'dumbbell'),
  (null, 'Hammer Curl', 'biceps', null, 'dumbbell'),
  (null, 'Tricep Rope Pushdown', 'triceps', null, 'cable'),
  (null, 'Overhead Tricep Extension', 'triceps', null, 'cable'),
  (null, 'Barbell Back Squat', 'quads', 'glutes', 'barbell'),
  (null, 'Leg Press', 'quads', 'glutes', 'machine'),
  (null, 'Leg Extension', 'quads', null, 'machine'),
  (null, 'Romanian Deadlift', 'hamstrings', 'glutes', 'barbell'),
  (null, 'Lying Leg Curl', 'hamstrings', null, 'machine'),
  (null, 'Standing Calf Raise', 'calves', null, 'machine'),
  (null, 'Hanging Leg Raise', 'abs', null, 'bodyweight'),
  (null, 'Cable Crunch', 'abs', null, 'cable');

-- 2. IFCT/NIN Indian Staples & Ingredients (macros per 100g / 100ml)
insert into public.ingredients (
  user_id, name, category, default_unit, unit_grams,
  calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_mess_dish
) values
  -- Grains & Rotis
  (null, 'Whole Wheat Flour (Atta)', 'grain', 'g', 100, 341, 12.1, 69.4, 1.7, false),
  (null, 'Phulka / Roti (Whole Wheat)', 'grain', 'roti', 35, 297, 9.8, 56.0, 2.5, false),
  (null, 'White Rice (Raw)', 'grain', 'g', 100, 356, 7.9, 78.2, 0.5, false),
  (null, 'White Rice (Cooked)', 'grain', 'katori', 150, 130, 2.7, 28.2, 0.3, false),
  (null, 'Rolled Oats', 'grain', 'g', 100, 389, 16.9, 66.3, 6.9, false),
  (null, 'Poha (Flattened Rice, Dry)', 'grain', 'g', 100, 346, 6.6, 77.3, 1.2, false),
  (null, 'Besan (Chickpea Flour)', 'grain', 'g', 100, 387, 22.0, 57.8, 6.7, false),

  -- Dals & Legumes
  (null, 'Toor / Arhar Dal (Raw)', 'dal_legume', 'g', 100, 335, 22.3, 57.6, 1.7, false),
  (null, 'Moong Dal (Yellow, Raw)', 'dal_legume', 'g', 100, 348, 24.5, 59.9, 1.2, false),
  (null, 'Masoor Dal (Raw)', 'dal_legume', 'g', 100, 343, 25.1, 59.0, 0.7, false),
  (null, 'Rajma (Kidney Beans, Raw)', 'dal_legume', 'g', 100, 346, 22.9, 60.6, 1.3, false),
  (null, 'Kabuli Chana (Chickpeas, Raw)', 'dal_legume', 'g', 100, 360, 17.1, 60.9, 5.3, false),
  (null, 'Soya Chunks (Nutrela, Dry)', 'protein', 'g', 100, 345, 52.0, 33.0, 0.5, false),

  -- Dairy & High-Protein Staples
  (null, 'Paneer (Low-Fat / Homemade)', 'dairy', 'g', 100, 265, 18.3, 1.2, 20.8, false),
  (null, 'Full Cream Milk (Buffalo/Amul Gold)', 'dairy', 'ml', 100, 87, 3.3, 4.9, 6.0, false),
  (null, 'Toned Milk', 'dairy', 'ml', 100, 58, 3.0, 4.7, 3.0, false),
  (null, 'Curd / Dahi (Toned)', 'dairy', 'katori', 150, 60, 3.1, 4.7, 3.0, false),
  (null, 'Greek Yogurt / Hung Curd', 'dairy', 'g', 100, 97, 9.0, 3.6, 5.0, false),

  -- Oils & Ghee (crucial for Indian cooking!)
  (null, 'Mustard Oil', 'oil_ghee', 'tbsp', 13.5, 884, 0, 0, 100, false),
  (null, 'Olive Oil', 'oil_ghee', 'tbsp', 13.5, 884, 0, 0, 100, false),
  (null, 'Refined Vegetable / Sunflower Oil', 'oil_ghee', 'tbsp', 13.5, 884, 0, 0, 100, false),
  (null, 'Desi Ghee', 'oil_ghee', 'tsp', 5, 900, 0, 0, 100, false),
  (null, 'Amul Butter', 'oil_ghee', 'tbsp', 14, 717, 0.9, 0.1, 81.0, false),

  -- Non-Veg & Supplements
  (null, 'Whole Egg (Boiled/Raw)', 'protein', 'piece', 50, 143, 12.6, 0.7, 9.5, false),
  (null, 'Egg White', 'protein', 'piece', 33, 52, 10.9, 0.7, 0.2, false),
  (null, 'Chicken Breast (Raw, Boneless)', 'protein', 'g', 100, 120, 22.5, 0, 2.6, false),
  (null, 'Whey Protein (1 Scoop ~32g)', 'supplement', 'scoop', 32, 375, 75.0, 9.0, 4.5, false),
  (null, 'Creatine Monohydrate', 'supplement', 'scoop', 5, 0, 0, 0, 0, false),

  -- Vegetables, Fruits & Nuts
  (null, 'Onion', 'vegetable', 'g', 100, 40, 1.1, 9.3, 0.1, false),
  (null, 'Tomato', 'vegetable', 'g', 100, 18, 0.9, 3.9, 0.2, false),
  (null, 'Potato (Aloo)', 'vegetable', 'g', 100, 77, 2.0, 17.5, 0.1, false),
  (null, 'Spinach (Palak)', 'vegetable', 'g', 100, 23, 2.9, 3.6, 0.4, false),
  (null, 'Banana', 'fruit', 'piece', 118, 89, 1.1, 22.8, 0.3, false),
  (null, 'Apple', 'fruit', 'piece', 180, 52, 0.3, 13.8, 0.2, false),
  (null, 'Peanut Butter (Unsweetened)', 'nut_seed', 'tbsp', 16, 588, 25.0, 20.0, 50.0, false),
  (null, 'Almonds (Badam)', 'nut_seed', 'g', 100, 579, 21.2, 21.6, 49.9, false),

  -- Common Mess / Eating Out Dishes (base Light/Home macros; Oil & Ghee Slider scales fat/kcal)
  (null, 'Dal Tadka (Mess/Restaurant)', 'mess_dish', 'katori', 180, 125, 5.5, 16.0, 4.2, true),
  (null, 'Dal Makhani (Mess/Restaurant)', 'mess_dish', 'katori', 180, 165, 6.2, 17.5, 7.8, true),
  (null, 'Paneer Butter Masala', 'mess_dish', 'katori', 180, 195, 7.5, 8.5, 14.5, true),
  (null, 'Rajma Masala', 'mess_dish', 'katori', 180, 135, 6.0, 19.0, 3.8, true),
  (null, 'Tandoori Roti', 'mess_dish', 'roti', 50, 260, 8.5, 52.0, 1.8, true),
  (null, 'Butter Naan', 'mess_dish', 'piece', 85, 310, 8.2, 50.0, 8.5, true),
  (null, 'Chicken Curry (Homestyle)', 'mess_dish', 'katori', 180, 155, 16.5, 4.5, 7.5, true),
  (null, 'Veg Biryani', 'mess_dish', 'katori', 200, 150, 3.5, 24.0, 4.5, true),
  (null, 'Chicken Biryani', 'mess_dish', 'katori', 220, 185, 11.5, 20.5, 6.2, true);
