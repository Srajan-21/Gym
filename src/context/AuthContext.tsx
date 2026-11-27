import React, { createContext, useContext } from 'react';

export interface AppUser {
  id: string;
  phone_number: string;
}

export const DEFAULT_USER: AppUser = {
  id: 'f2e764f6-db52-47f5-a63d-29831c5bca7e',
  phone_number: '7007968745',
};

interface AuthContextValue {
  user: AppUser;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: DEFAULT_USER,
  loading: false,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: DEFAULT_USER,
        loading: false,
        signIn: async () => {},
        signUp: async () => {},
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
