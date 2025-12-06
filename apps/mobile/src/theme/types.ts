import type { Theme as NavigationTheme } from "@react-navigation/native";
import type { StatusBarStyle } from "expo-status-bar";

export type Mode = "light" | "dark";

export type ThemeColors = {
  background: string;
  surfaceCard: string;
  surfaceElevated: string;
  surfaceMuted: string;
  border: string;
  borderMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
  accent: string;
  accentAlt: string;
  success: string;
  warning: string;
  danger: string;
};

export type ThemeGradients = {
  hero: readonly [string, string];
  heroAlt: readonly [string, string];
  card: readonly [string, string];
  cardAlt: readonly [string, string];
  dexHero: readonly [string, string];
  dexInfo: readonly [string, string];
  profileHero: readonly [string, string];
  tabBar: readonly [string, string];
};

export type ThemeShadows = {
  card: string;
  elevated: string;
};

export type AppTheme = {
  mode: Mode;
  colors: ThemeColors;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
  navigation: NavigationTheme;
  statusBarStyle: StatusBarStyle;
};

export type ThemeContextValue = {
  theme: AppTheme;
  mode: "system" | Mode;
  resolvedMode: Mode;
  setMode: (mode: "system" | Mode) => void;
};
