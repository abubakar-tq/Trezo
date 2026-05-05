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
  accent: "#00FFFF",
  accentAlt: "#FF00FF",
  accentSoft: "rgba(0, 255, 255, 0.12)",
  success: "#22C55E",
  successSoft: "rgba(34, 197, 94, 0.12)",
  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.12)",
  danger: "#EF4444",
  dangerSoft: "rgba(248, 113, 113, 0.15)",
  glass: "rgba(255, 255, 255, 0.03)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  inputBackground: "#171419",
  inputBorder: "#333333",
};

const lightColors: ThemeColors = {
  background: "#F9FBFF",
  surface: "#FFFFFF",
  surfaceCard: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  border: "rgba(0, 0, 0, 0.15)",
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
  accentSoft: "rgba(0, 163, 163, 0.12)",
  success: "#10B981",
  successSoft: "rgba(16, 185, 129, 0.12)",
  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.12)",
  danger: "#EF4444",
  dangerSoft: "rgba(239, 68, 68, 0.12)",
  glass: "#FFFFFF",
  glassBorder: "rgba(0, 0, 0, 0.12)",
  inputBackground: "#FFFFFF",
  inputBorder: "rgba(0, 0, 0, 0.15)",
};

const darkGradients: ThemeGradients = {
  hero: ["#050505", "#050505"],
  heroAlt: ["#101010", "#050505"],
  card: ["#141414", "#050505"],
  cardAlt: ["#1A1A1A", "#050505"],
  dexHero: ["#002020", "#050505"],
  dexInfo: ["#001515", "#050505"],
  profileHero: ["#050505", "#050505"],
  tabBar: ["rgba(5, 5, 5, 0.95)", "rgba(5, 5, 5, 0.85)"],
  brand: ["#7955a0", "#6d52d6", "#0088ff"],
  brandSoft: ["rgba(121, 85, 160, 0.18)", "rgba(0, 136, 255, 0.18)"],
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
  brand: ["#7955a0", "#6d52d6", "#0088ff"],
  brandSoft: ["rgba(121, 85, 160, 0.10)", "rgba(0, 136, 255, 0.10)"],
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
