import AsyncStorage from '@react-native-async-storage/async-storage';
import { MacroTotals } from './nutrition';

const GEMINI_KEY_STORAGE = 'gym_gemini_api_key_v1';
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'] as const;

export interface ExtractedMeal extends MacroTotals {
  meal_name: string;
  breakdown: string;
}

export async function getGeminiApiKey(): Promise<string> {
  const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (envKey) return envKey;
  const stored = await AsyncStorage.getItem(GEMINI_KEY_STORAGE);
  return stored?.trim() ?? '';
}

export async function saveGeminiApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
}

async function callGeminiModel(
  model: string,
  apiKey: string,
  prompt: string,
  timeoutMs = 10000
): Promise<ExtractedMeal> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawText) {
      throw new Error('Gemini returned an empty response.');
    }

    const parsed = JSON.parse(rawText) as Partial<ExtractedMeal>;
    return {
      meal_name: (parsed.meal_name ?? '').trim(),
      calories: Math.round(Number(parsed.calories) || 0),
      protein_g: Math.round((Number(parsed.protein_g) || 0) * 10) / 10,
      carbs_g: Math.round((Number(parsed.carbs_g) || 0) * 10) / 10,
      fat_g: Math.round((Number(parsed.fat_g) || 0) * 10) / 10,
      breakdown: (parsed.breakdown ?? '').trim(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeMealWithGemini(description: string): Promise<ExtractedMeal> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('NO_GEMINI_KEY');
  }

  const prompt = `Estimate total nutrition for this meal or recipe:
"${description.trim()}"

Return ONLY JSON:
{"meal_name":"short title","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"breakdown":"brief 1-line portion breakdown"}`;

  let lastError: unknown = null;
  for (const model of MODELS) {
    try {
      const res = await callGeminiModel(model, apiKey, prompt, 10000);
      return {
        ...res,
        meal_name: res.meal_name || description.trim(),
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Request timed out. Please try again.');
}
