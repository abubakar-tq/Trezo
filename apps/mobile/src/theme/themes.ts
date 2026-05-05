import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from "@react-navigation/native";

import { withAlpha } from "@utils/color";

import type { AppTheme, Mode, ThemeColors, ThemeGradients } from "./types";

const darkColors: ThemeColors = {
  background: "#050505",
  surface: "rgba(10, 10, 10, 0.8)",
  surfaceCard: "rgba(15, 15, 15, 0.6)",
  surfaceElevated: "rgba(25, 25, 25, 0.9)",
  surfaceMuted: "rgba(15, 15, 15, 0.4)",
  border: "rgba(255, 255, 255, 0.06)",
  borderMuted: "rgba(255, 255, 255, 0.03)",
  text: "#FFFFFF",
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",
  secondaryText: "#94A3B8",
  textMuted: "#64748B",
  textOnAccent: "#000000",
  textOnHero: "#FFFFFF",
  accent: "#00FFFF", // Neon Cyan
  accentAlt: "#FF00FF", // Neon Pink
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  glass: "rgba(255, 255, 255, 0.03)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
};

const lightColors: ThemeColors = {
  background: "#F9FBFF", // Crisp Ice White
  surface: "#FFFFFF",
  surfaceCard: "#FFFFFF", // Pure White Card
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  border: "rgba(0, 0, 0, 0.15)", // Significantly darkened for clear distinction
  borderMuted: "rgba(0, 0, 0, 0.08)",
  text: "#0F172A",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  secondaryText: "#64748B",
  textMuted: "#94A3B8",
  textOnAccent: "#FFFFFF",
  textOnHero: "#0F172A",
  accent: "#00A3A3",
  accentAlt: "#A300A3",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  glass: "#FFFFFF",
  glassBorder: "rgba(0, 0, 0, 0.12)", // More visible glass boundary
};

const darkGradients: ThemeGradients = {
  hero: ["#050505", "#050505"], // Solid deep black for hero background
  heroAlt: ["#101010", "#050505"],
  card: ["#141414", "#050505"],
  cardAlt: ["#1A1A1A", "#050505"],
  dexHero: ["#002020", "#050505"],
  dexInfo: ["#001515", "#050505"],
  profileHero: ["#050505", "#050505"],
  tabBar: ["rgba(5, 5, 5, 0.95)", "rgba(5, 5, 5, 0.85)"],
};

const lightGradients: ThemeGradients = {
  hero: ["#FFFFFF", "#F9FAFB"],
  heroAlt: ["#F9FAFB", "#FFFFFF"],
  card: ["#FFFFFF", "#F9FAFB"],
  cardAlt: ["#F9FAFB", "#FFFFFF"],
  dexHero: ["#E0F2FF", "#F9FAFB"],
  dexInfo: ["#F1F5F9", "#FFFFFF"],
  profileHero: ["#FFFFFF", "#FFFFFF"],
  tabBar: ["rgba(255, 255, 255, 0.95)", "rgba(249, 250, 251, 0.9)"],
};

const createNavigationTheme = (
  base: typeof NavigationDarkTheme | typeof NavigationLightTheme,
  colors: ThemeColors,
) => ({
  ...base,
  colors: {
    ...base.colors,
    background: colors.background,
    card: colors.surfaceCard,
    border: colors.border,
    text: colors.textPrimary,
    primary: colors.accent,
    notification: colors.accentAlt,
  },
});

const createTheme = (mode: Mode): AppTheme => {
  const colors = mode === "dark" ? darkColors : lightColors;
  const gradients = mode === "dark" ? darkGradients : lightGradients;
  const navigation = createNavigationTheme(
    mode === "dark" ? NavigationDarkTheme : NavigationLightTheme,
    colors,
  );

  return {
    mode,
    colors,
    gradients,
    shadows: {
      card: mode === "dark" 
        ? "rgba(0, 0, 0, 0.4)" 
        : "rgba(71, 85, 105, 0.1)", // Sophisticated Slate Shadow
      elevated: mode === "dark" 
        ? "rgba(0, 0, 0, 0.6)" 
        : "rgba(71, 85, 105, 0.15)",
    },
    navigation,
    statusBarStyle: mode === "dark" ? "light" : "dark",
  };
};

export const darkTheme = createTheme("dark");
export const lightTheme = createTheme("light");

export const getThemeForMode = (mode: Mode): AppTheme => (mode === "dark" ? darkTheme : lightTheme);
