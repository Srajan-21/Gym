import { NativeModules, Platform } from 'react-native';

interface GymNativeInterface {
  hasOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): void;
  startFloatingOverlay(
    exerciseId: string,
    exerciseName: string,
    weightKg: number,
    reps: number
  ): void;
  stopFloatingOverlay(): void;
  updateWidgetSnapshot(
    remainingCalories: number,
    remainingProtein: number,
    waterGlasses: number,
    splitName: string
  ): void;
  consumePendingLogs(): Promise<string>;
}

const nativeModule: GymNativeInterface | undefined =
  Platform.OS === 'android' ? NativeModules.GymNative : undefined;

export interface PendingOverlayPayload {
  sets: {
    exerciseId: string;
    weightKg: number;
    reps: number;
    loggedAt: number;
  }[];
  waterDelta: number;
}

export const GymAndroidNative = {
  isSupported(): boolean {
    return Platform.OS === 'android' && Boolean(nativeModule);
  },

  async hasOverlayPermission(): Promise<boolean> {
    if (!nativeModule) return false;
    return nativeModule.hasOverlayPermission();
  },

  requestOverlayPermission(): void {
    nativeModule?.requestOverlayPermission();
  },

  startFloatingOverlay(
    exerciseId: string,
    exerciseName: string,
    weightKg = 20,
    reps = 10
  ): void {
    nativeModule?.startFloatingOverlay(exerciseId, exerciseName, weightKg, reps);
  },

  stopFloatingOverlay(): void {
    nativeModule?.stopFloatingOverlay();
  },

  updateWidgetSnapshot(params: {
    remainingCalories: number;
    remainingProtein: number;
    waterGlasses: number;
    splitName: string;
  }): void {
    nativeModule?.updateWidgetSnapshot(
      Math.max(0, Math.round(params.remainingCalories)),
      Math.max(0, Math.round(params.remainingProtein)),
      Math.max(0, params.waterGlasses),
      params.splitName
    );
  },

  async consumePendingLogs(): Promise<PendingOverlayPayload> {
    if (!nativeModule) return { sets: [], waterDelta: 0 };
    try {
      const raw = await nativeModule.consumePendingLogs();
      return JSON.parse(raw) as PendingOverlayPayload;
    } catch {
      return { sets: [], waterDelta: 0 };
    }
  },
};
