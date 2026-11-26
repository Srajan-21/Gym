import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10 || password.length < 6) {
      Alert.alert(
        'Invalid Input',
        'Enter a valid phone number (at least 10 digits) and a password of at least 6 characters.'
      );
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(digits, password);
      } else {
        await signIn(digits, password);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Could not authenticate.';
      Alert.alert('Auth Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Dumbbell size={30} color={Colors.gold} />
        </View>
        <Text style={styles.brandKicker}>PERSONAL PERFORMANCE</Text>
        <Text style={styles.title}>Srajan&apos;s</Text>
        <Text style={styles.subtitle}>
          {isSignUp
            ? 'Create your account with phone & password'
            : 'Sign in with your phone number'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Phone Number (e.g. 9876543210)"
          placeholderTextColor={Colors.textMuted}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 chars)"
          placeholderTextColor={Colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.primaryText} />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
          )}
        </Pressable>

        <Pressable style={styles.switchBtn} onPress={() => setIsSignUp((v) => !v)}>
          <Text style={styles.switchText}>
            {isSignUp ? 'Already have an account? Sign In' : 'New here? Create Account'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandKicker: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  input: {
    backgroundColor: Colors.bg,
    color: Colors.text,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  switchBtn: {
    marginTop: 18,
    alignItems: 'center',
  },
  switchText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
