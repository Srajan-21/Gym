import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface AppUser {
  id: string;
  phone_number: string;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const STORAGE_KEY = 'srajans_app_user_v1';

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setUser(JSON.parse(raw) as AppUser);
        }
      } catch {
        // Ignore storage read failure
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistUser = async (nextUser: AppUser) => {
    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  };

  const signIn = async (phone: string, password: string) => {
    const digits = normalizePhone(phone);
    if (digits.length < 10) {
      throw new Error('Enter a valid 10-digit phone number.');
    }

    const { data, error } = await supabase
      .from('app_users')
      .select('id, phone_number, password')
      .eq('phone_number', digits)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || data.password !== password) {
      throw new Error('Invalid phone number or password.');
    }

    await persistUser({ id: data.id, phone_number: data.phone_number });
  };

  const signUp = async (phone: string, password: string) => {
    const digits = normalizePhone(phone);
    if (digits.length < 10) {
      throw new Error('Enter a valid 10-digit phone number.');
    }

    const { data: existing } = await supabase
      .from('app_users')
      .select('id')
      .eq('phone_number', digits)
      .maybeSingle();

    if (existing) {
      throw new Error('Phone number already registered. Please Sign In.');
    }

    const { data, error } = await supabase
      .from('app_users')
      .insert({
        phone_number: digits,
        password,
      })
      .select('id, phone_number')
      .single();

    if (error) throw new Error(error.message);
    await persistUser({ id: data.id, phone_number: data.phone_number });
  };

  const signOut = async () => {
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
