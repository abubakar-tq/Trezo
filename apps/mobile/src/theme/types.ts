import type { Theme as NavigationTheme } from "@react-navigation/native";
import type { StatusBarStyle } from "expo-status-bar";

export type Mode = "light" | "dark";

export type ThemeColors = {
  // Backgrounds
  background: string;
  surface: string;
  surfaceCard: string;
  surfaceElevated: string;
  surfaceMuted: string;
  // Borders
  border: string;
  borderMuted: string;
  // Text
  text: string;
  textPrimary: string;
  textSecondary: string;
  secondaryText: string;
  textMuted: string;
  textOnAccent: string;
  textOnHero: string;
  // Accents
  accent: string;
  accentAlt: string;
  accentSoft: string;
  // Semantic states
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  // Glass surfaces
  glass: string;
  glassBorder: string;
  // Input surfaces (auth bridge)
  inputBackground: string;
  inputBorder: string;
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
  // Brand gradient (auth bridge — available now, consumed when auth screens migrate)
  brand: readonly [string, string, string];
  brandSoft: readonly [string, string];
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
