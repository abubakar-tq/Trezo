import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Runtime-toggleable developer settings. These only have any effect in __DEV__
 * builds — the call-sites gate on `__DEV__` so nothing here can leak into a
 * production build even if the persisted flag is somehow true.
 */
export type DevSettingsState = {
  // When on, the Email Recovery setup screen exposes short (5m/30m/1h) safety
  // delays so the execute step can be tested without waiting out a 24–48h
  // production delay. The deployed module uses minimumDelay = 0, so these are
  // valid on-chain as long as the derived expiry keeps the recovery window
  // above the 2-day floor (see deriveExpiryMinutes).
  allowShortRecoveryDelays: boolean;
  setAllowShortRecoveryDelays: (value: boolean) => void;
};

export const useDevSettingsStore = create<DevSettingsState>()(
  persist(
    (set) => ({
      allowShortRecoveryDelays: false,
      setAllowShortRecoveryDelays: (value) =>
        set({ allowShortRecoveryDelays: value }),
    }),
    {
      name: "Trezo_Wallet-dev-settings-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ allowShortRecoveryDelays }) => ({
        allowShortRecoveryDelays,
      }),
    },
  ),
);
