import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const LOCK_ENABLED_KEY = "trezo-lock-enabled";

const DEFAULT_PROMPT = "Unlock Trezo Wallet";

const FALLBACK_OPTIONS: LocalAuthentication.LocalAuthenticationOptions = {
  promptMessage: DEFAULT_PROMPT,
  fallbackLabel: "Use PIN or Password",
  cancelLabel: "Cancel",
  disableDeviceFallback: false,
};

export type AppLockState = {
  hasInitialized: boolean;
  isLocked: boolean;
  isAuthenticating: boolean;
  isBiometricAvailable: boolean;
  lockEnabled: boolean;
  lastError: string | null;
  lastUnlockedAt: number | null;
  authContextActive: boolean;
  initialize: () => Promise<void>;
  authenticate: (options?: LocalAuthentication.LocalAuthenticationOptions) => Promise<boolean>;
  lock: () => void;
  unlock: () => void;
  setLockEnabled: (enabled: boolean) => Promise<void>;
  setAuthContext: (active: boolean) => void;
};

export const useAppLockStore = create<AppLockState>((set, get) => ({
  hasInitialized: false,
  isLocked: false, // Start unlocked until initialized
  isAuthenticating: false,
  isBiometricAvailable: false,
  lockEnabled: true,
  lastError: null,
  lastUnlockedAt: Date.now(), // Set initial unlock time
  authContextActive: false,

  initialize: async () => {
    if (get().hasInitialized) return;

    const storedPreference = await SecureStore.getItemAsync(LOCK_ENABLED_KEY);
    const lockEnabled = storedPreference !== "false";

    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

    // Don't lock immediately on initialization - let the app load first
    // The useAppLock hook will handle locking when appropriate
    set({
      hasInitialized: true,
      lockEnabled,
      isLocked: lockEnabled, // Lock by default if enabled
      isBiometricAvailable: hasHardware && isEnrolled,
      lastError: null,
      lastUnlockedAt: 0, // Reset unlock time on initialization
    });
  },

  authenticate: async (options) => {
    const { lockEnabled, authContextActive } = get();
    if (!lockEnabled || !authContextActive) {
      set({ isLocked: false, lastError: null, isAuthenticating: false });
      return true;
    }

    set({ isAuthenticating: true, lastError: null });
    try {
      const result = await LocalAuthentication.authenticateAsync({
        ...FALLBACK_OPTIONS,
        ...options,
      });

      if (result.success) {
        set({ isLocked: false, isAuthenticating: false, lastError: null, lastUnlockedAt: Date.now() });
        return true;
      }

      const message = result.warning ?? result.error ?? null;
      set({
        isLocked: true,
        isAuthenticating: false,
        lastError: message,
      });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      set({
        isLocked: true,
        isAuthenticating: false,
        lastError: message,
      });
      return false;
    }
  },

  lock: () => {
    if (!get().lockEnabled || !get().authContextActive) return;
    set({ isLocked: true, lastError: null });
  },

  unlock: () => {
    set({ isLocked: false, lastError: null, lastUnlockedAt: Date.now() });
  },

  setLockEnabled: async (enabled: boolean) => {
    set({ lockEnabled: enabled });
    await SecureStore.setItemAsync(LOCK_ENABLED_KEY, enabled ? "true" : "false");
    const { authContextActive } = get();
    if (!enabled || !authContextActive) {
      set({ isLocked: false, lastError: null, lastUnlockedAt: Date.now() });
    }
  },

  setAuthContext: (active: boolean) => {
    if (active) {
      set((state) => ({
        authContextActive: true,
        isLocked: state.lockEnabled ? state.isLocked : false,
        lastUnlockedAt: Date.now(),
      }));
      return;
    }

    set({
      authContextActive: false,
      isLocked: false,
      isAuthenticating: false,
      lastError: null,
      lastUnlockedAt: Date.now(),
    });
  },
}));
