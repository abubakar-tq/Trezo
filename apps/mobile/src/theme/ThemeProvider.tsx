import React, { PropsWithChildren, createContext, useContext, useEffect, useMemo } from "react";
import { Appearance } from "react-native";

import { useAppearanceStore } from "@store/useAppearanceStore";

import { darkTheme, lightTheme } from "./themes";
import type { ThemeContextValue } from "./types";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const AppThemeProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const mode = useAppearanceStore((state) => state.mode);
  const systemMode = useAppearanceStore((state) => state.systemMode);
  const setMode = useAppearanceStore((state) => state.setMode);
  const setSystemMode = useAppearanceStore((state) => state.setSystemMode);

  const resolvedMode = useMemo(() => (mode === "system" ? systemMode ?? "light" : mode), [mode, systemMode]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemMode(colorScheme);
    });
    return () => subscription.remove();
  }, [setSystemMode]);

  const theme = useMemo(() => (resolvedMode === "dark" ? darkTheme : lightTheme), [resolvedMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      resolvedMode,
      setMode,
    }),
    [mode, resolvedMode, setMode, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
};
