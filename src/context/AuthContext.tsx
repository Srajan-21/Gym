import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function toInternalAuthEmail(digits: string): string {
  return `srajan.${digits}@gmail.com`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (phone: string, password: string) => {
    const digits = normalizePhone(phone);
    if (digits.length < 10) {
      throw new Error('Enter a valid 10-digit phone number.');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: toInternalAuthEmail(digits),
      password,
    });
    if (error) throw error;
  };

  const signUp = async (phone: string, password: string) => {
    const digits = normalizePhone(phone);
    if (digits.length < 10) {
      throw new Error('Enter a valid 10-digit phone number.');
    }
    const { data, error } = await supabase.auth.signUp({
      email: toInternalAuthEmail(digits),
      password,
      options: {
        data: { phone_number: digits },
      },
    });
    if (error) throw error;

    if (data.user) {
      await supabase.from('user_profiles').upsert(
        {
          user_id: data.user.id,
          phone_number: digits,
        },
        { onConflict: 'user_id' }
      );
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
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
