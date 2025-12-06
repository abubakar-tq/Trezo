import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, ColorSchemeName } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppearanceMode = "system" | "light" | "dark";

export type AppearanceState = {
  mode: AppearanceMode;
  systemMode: Exclude<ColorSchemeName, "no-preference">;
  setMode: (mode: AppearanceMode) => void;
  setSystemMode: (scheme: ColorSchemeName | null | undefined) => void;
};

const getInitialSystemMode = (): Exclude<ColorSchemeName, "no-preference"> => {
  const scheme = Appearance.getColorScheme();
  if (scheme === "dark" || scheme === "light") {
    return scheme;
  }
  return "light";
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      mode: "system",
      systemMode: getInitialSystemMode(),
      setMode: (mode) => set({ mode }),
      setSystemMode: (scheme) =>
        set((state) => ({
          systemMode:
            scheme === "dark" || scheme === "light" ? scheme : state.systemMode,
        })),
    }),
    {
      name: "Trezo_Wallet-appearance-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ mode }) => ({ mode }),
    },
  ),
);

export const selectResolvedMode = (state: AppearanceState): "light" | "dark" => {
  if (state.mode === "system") {
    return state.systemMode ?? "light";
  }
  return state.mode;
};
