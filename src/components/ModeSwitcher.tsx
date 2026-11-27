import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Dumbbell, Wallet } from 'lucide-react-native';
import { Colors } from '../theme/colors';

interface ModeSwitcherProps {
  activeMode: 'gym' | 'finance';
}

export function ModeSwitcher({ activeMode }: ModeSwitcherProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.pill, activeMode === 'gym' && styles.pillActive]}
        onPress={() => {
          if (activeMode !== 'gym') router.replace('/(tabs)');
        }}
      >
        <Dumbbell
          size={13}
          color={activeMode === 'gym' ? Colors.primaryText : Colors.textSecondary}
        />
        <Text style={[styles.text, activeMode === 'gym' && styles.textActive]}>Gym</Text>
      </Pressable>
      <Pressable
        style={[styles.pill, activeMode === 'finance' && styles.pillActive]}
        onPress={() => {
          if (activeMode !== 'finance') router.replace('/finance');
        }}
      >
        <Wallet
          size={13}
          color={activeMode === 'finance' ? Colors.primaryText : Colors.textSecondary}
        />
        <Text style={[styles.text, activeMode === 'finance' && styles.textActive]}>Finances</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: Colors.primary,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  textActive: {
    color: Colors.primaryText,
  },
});
