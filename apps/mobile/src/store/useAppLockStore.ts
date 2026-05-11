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
  securityLevel: LocalAuthentication.SecurityLevel;
  lockEnabled: boolean;
  lastError: string | null;
  lastUnlockedAt: number | null;
  authContextActive: boolean;
  initialize: () => Promise<void>;
  refreshSecurityLevel: () => Promise<LocalAuthentication.SecurityLevel>;
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
  securityLevel: LocalAuthentication.SecurityLevel.NONE,
  lockEnabled: true,
  lastError: null,
  lastUnlockedAt: Date.now(), // Set initial unlock time
  authContextActive: false,

  initialize: async () => {
    if (get().hasInitialized) return;

    const storedPreference = await SecureStore.getItemAsync(LOCK_ENABLED_KEY);
    const lockEnabled = storedPreference !== "false";

    const [hasHardware, isEnrolled, securityLevel] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);

    // Don't lock immediately on initialization - let the app load first
    // The useAppLock hook will handle locking when appropriate
    set({
      hasInitialized: true,
      lockEnabled,
      isLocked: false, // Start unlocked, let useAppLock determine if lock is needed
      isBiometricAvailable: hasHardware && isEnrolled,
      securityLevel,
      lastError: null,
      lastUnlockedAt: Date.now(), // Set initial time to prevent immediate lock
    });
  },

  refreshSecurityLevel: async () => {
    const [hasHardware, isEnrolled, securityLevel] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    set({
      isBiometricAvailable: hasHardware && isEnrolled,
      securityLevel,
    });
    return securityLevel;
  },

  authenticate: async (options) => {
    const { lockEnabled, authContextActive, securityLevel, isAuthenticating } = get();
    if (!lockEnabled || !authContextActive) {
      set({ isLocked: false, lastError: null, isAuthenticating: false });
      return true;
    }

    // Drop concurrent calls. Expo's Android module cancels the in-flight
    // promise and replaces it without opening a new prompt — that race is what
    // makes the lock screen "blink" when the auto-attempt and a button press
    // overlap. Let the in-flight call finish; the caller can retry after.
    if (isAuthenticating) {
      return false;
    }

    // Nothing to authenticate against — don't fire the native prompt (it will
    // reject instantly and cause the lock screen to "blink"). Caller is expected
    // to surface the device-setup prompt UI instead.
    if (securityLevel === LocalAuthentication.SecurityLevel.NONE) {
      set({
        isLocked: true,
        isAuthenticating: false,
        lastError: "Set up a screen lock (PIN, pattern, or biometric) in your device settings to unlock Trezo.",
      });
      return false;
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
