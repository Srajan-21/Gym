import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyRound, Sparkles, X } from 'lucide-react-native';
import {
  analyzeMealWithGemini,
  ExtractedMeal,
  getGeminiApiKey,
  saveGeminiApiKey,
} from '../lib/geminiNutrition';
import { MacroTotals } from '../lib/nutrition';
import { Colors } from '../theme/colors';

interface AiMealModalProps {
  visible: boolean;
  mealTime: string;
  onClose: () => void;
  onLogMeal: (mealName: string, macros: MacroTotals) => Promise<void>;
}

export function AiMealModal({ visible, mealTime, onClose, onLogMeal }: AiMealModalProps) {
  const [description, setDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ExtractedMeal | null>(null);

  const [mealName, setMealName] = useState('');
  const [calInput, setCalInput] = useState('');
  const [proInput, setProInput] = useState('');
  const [carbInput, setCarbInput] = useState('');
  const [fatInput, setFatInput] = useState('');

  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      const existing = await getGeminiApiKey();
      setShowKeyInput(!existing);
      if (existing) setApiKeyInput(existing);
    })();
  }, [visible]);

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) {
      Alert.alert('Key Required', 'Paste your Gemini API key first.');
      return;
    }
    await saveGeminiApiKey(apiKeyInput);
    setShowKeyInput(false);
    Alert.alert('Saved', 'Gemini API key saved on this device.');
  };

  const handleAnalyze = async () => {
    if (!description.trim()) {
      Alert.alert('Enter Meal', 'Type a meal or recipe (e.g. half cup cappuccino without sugar).');
      return;
    }
    setAnalyzing(true);
    try {
      const extracted = await analyzeMealWithGemini(description);
      setResult(extracted);
      setMealName(extracted.meal_name);
      setCalInput(String(extracted.calories));
      setProInput(String(extracted.protein_g));
      setCarbInput(String(extracted.carbs_g));
      setFatInput(String(extracted.fat_g));
    } catch (err) {
      if (err instanceof Error && err.message === 'NO_GEMINI_KEY') {
        setShowKeyInput(true);
        Alert.alert('Gemini Key Needed', 'Paste your Gemini API key below to analyze meals.');
      } else {
        Alert.alert('Analysis Failed', err instanceof Error ? err.message : 'Could not analyze meal.');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLog = async () => {
    if (!mealName.trim()) return;
    await onLogMeal(mealName.trim(), {
      calories: parseFloat(calInput) || 0,
      protein_g: parseFloat(proInput) || 0,
      carbs_g: parseFloat(carbInput) || 0,
      fat_g: parseFloat(fatInput) || 0,
    });
    setDescription('');
    setResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowGapSmall}>
              <Sparkles size={18} color={Colors.gold} />
              <Text style={styles.title}>
                AI Meal / Recipe{mealTime.trim() ? ` (${mealTime.trim()})` : ''}
              </Text>
            </View>
            <View style={styles.rowGapSmall}>
              <Pressable onPress={() => setShowKeyInput((v) => !v)} style={styles.keyBtn}>
                <KeyRound size={15} color={Colors.textSecondary} />
              </Pressable>
              <Pressable onPress={onClose}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
            {showKeyInput && (
              <View style={styles.keyBox}>
                <Text style={styles.miniLabel}>Gemini API Key</Text>
                <View style={styles.rowGap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={apiKeyInput}
                    onChangeText={setApiKeyInput}
                    placeholder="AIza..."
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry
                  />
                  <Pressable style={styles.saveKeyBtn} onPress={() => void handleSaveKey()}>
                    <Text style={styles.saveKeyText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Text style={styles.miniLabel}>
              Describe your meal or paste a recipe (e.g. &quot;half cup cappuccino without sugar&quot;)
            </Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              numberOfLines={3}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. half cup cappuccino without sugar, or 2 eggs + 1 roti with 1 tsp ghee..."
              placeholderTextColor={Colors.textMuted}
            />

            <Pressable
              style={styles.analyzeBtn}
              onPress={() => void handleAnalyze()}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator size="small" color={Colors.primaryText} />
              ) : (
                <>
                  <Sparkles size={16} color={Colors.primaryText} />
                  <Text style={styles.analyzeBtnText}>Extract Calories &amp; Macros</Text>
                </>
              )}
            </Pressable>

            {result && (
              <View style={styles.resultBox}>
                {Boolean(result.breakdown) && (
                  <Text style={styles.breakdownText}>{result.breakdown}</Text>
                )}
                <View>
                  <Text style={styles.miniLabel}>Meal Name</Text>
                  <TextInput style={styles.input} value={mealName} onChangeText={setMealName} />
                </View>
                <View style={styles.rowGap}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Calories</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={calInput}
                      onChangeText={setCalInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Protein (g)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={proInput}
                      onChangeText={setProInput}
                    />
                  </View>
                </View>
                <View style={styles.rowGap}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Carbs (g)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={carbInput}
                      onChangeText={setCarbInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miniLabel}>Fat (g)</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      value={fatInput}
                      onChangeText={setFatInput}
                    />
                  </View>
                </View>
                <Pressable style={styles.logBtn} onPress={() => void handleLog()}>
                  <Text style={styles.analyzeBtnText}>Log Meal</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGapSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowGap: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  title: { color: Colors.text, fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  keyBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keyBox: {
    backgroundColor: Colors.bg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    gap: 6,
  },
  saveKeyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  saveKeyText: { color: Colors.primaryText, fontSize: 13, fontWeight: '700' },
  miniLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
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
  multiline: { minHeight: 78, textAlignVertical: 'top' },
  analyzeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzeBtnText: { color: Colors.primaryText, fontSize: 14, fontWeight: '700' },
  resultBox: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  breakdownText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  logBtn: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
});
