import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { DateProvider } from '../context/DateContext';
import { Colors } from '../theme/colors';

export default function RootLayout() {
  return (
    <AuthProvider>
      <DateProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.text,
            contentStyle: { backgroundColor: Colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="split-planner"
            options={{
              title: 'Split Planner',
              presentation: 'modal',
            }}
          />
        </Stack>
      </DateProvider>
    </AuthProvider>
  );
}
