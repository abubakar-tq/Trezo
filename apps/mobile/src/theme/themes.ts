import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from "@react-navigation/native";

import type { AppTheme, Mode, ThemeColors, ThemeGradients } from "./types";

const darkColors: ThemeColors = {
  // Backgrounds — ink black with barely-perceptible violet undertone
  background: "#060608",
  surface: "rgba(14, 12, 18, 0.92)",
  surfaceCard: "rgba(18, 15, 24, 0.70)",
  surfaceElevated: "rgba(24, 20, 32, 0.95)",
  surfaceMuted: "rgba(14, 12, 18, 0.40)",
  // Borders — ghost violet (replaces raw white borders)
  border: "rgba(124, 58, 237, 0.10)",
  borderMuted: "rgba(124, 58, 237, 0.05)",
  // Text — warm ivory hierarchy. Never pure #FFFFFF on dark OLED.
  text: "#F4F1EA",
  textPrimary: "#F4F1EA",
  textSecondary: "#8E8B85",
  textMuted: "#5C5A55",
  textOnAccent: "#F4F1EA",
  textOnHero: "#F4F1EA",
  // Accents — Violet-700 as primary brand, Cyan-500 as action/outbound context
  accent: "#7C3AED",
  accentAlt: "#06B6D4",
  accentSoft: "rgba(124, 58, 237, 0.12)",
  // Semantic — emerald from locked ShieldScene, terracotta replaces crimson
  dataPositive: "#34D399",
  dataNegative: "#E8654F",
  success: "#10B981",
  successSoft: "rgba(16, 185, 129, 0.12)",
  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.12)",
  danger: "#E8654F",
  dangerSoft: "rgba(232, 101, 79, 0.12)",
  // Glass — ivory-tint (not white-tint), violet ghost border
  glass: "rgba(244, 241, 234, 0.02)",
  glassBorder: "rgba(124, 58, 237, 0.08)",
  // Inputs
  inputBackground: "rgba(14, 12, 18, 0.80)",
  inputBorder: "rgba(124, 58, 237, 0.15)",
};

const lightColors: ThemeColors = {
  // Backgrounds — warm white, not stark paper-white
  background: "#FAFAF8",
  surface: "#FFFFFF",
  surfaceCard: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F4F1EA",
  // Borders — warm neutral
  border: "rgba(26, 24, 20, 0.10)",
  borderMuted: "rgba(26, 24, 20, 0.06)",
  // Text — warm near-black (not cold slate)
  text: "#1A1814",
  textPrimary: "#1A1814",
  textSecondary: "#6B6860",
  textMuted: "#9B9890",
  textOnAccent: "#FFFFFF",
  textOnHero: "#1A1814",
  // Accents — same violet/cyan as dark mode for brand consistency
  accent: "#7C3AED",
  accentAlt: "#06B6D4",
  accentSoft: "rgba(124, 58, 237, 0.10)",
  // Semantic — deepened for light mode readability
  dataPositive: "#059669",
  dataNegative: "#C94B35",
  success: "#059669",
  successSoft: "rgba(5, 150, 105, 0.10)",
  warning: "#D97706",
  warningSoft: "rgba(217, 119, 6, 0.10)",
  danger: "#C94B35",
  dangerSoft: "rgba(201, 75, 53, 0.10)",
  // Glass
  glass: "#FFFFFF",
  glassBorder: "rgba(26, 24, 20, 0.08)",
  // Inputs
  inputBackground: "#FFFFFF",
  inputBorder: "rgba(26, 24, 20, 0.12)",
};

const darkGradients: ThemeGradients = {
  // All gradients carry the violet undertone — ink shifts to violet-dark, not plain grey
  hero: ["#060608", "#0A080F"],
  heroAlt: ["#0A080F", "#060608"],
  card: ["#0E0C12", "#060608"],
  cardAlt: ["#12101A", "#060608"],
  dexHero: ["#060820", "#060608"],
  dexInfo: ["#080612", "#060608"],
  profileHero: ["#0A080F", "#060608"],
  tabBar: ["rgba(6, 6, 8, 0.97)", "rgba(6, 6, 8, 0.90)"],
  // Brand gradient: pure violet family — replaces old purple→blue which conflicted with locked scenes
  brand: ["#8B5CF6", "#7C3AED", "#6D28D9"],
  brandSoft: ["rgba(124, 58, 237, 0.18)", "rgba(109, 40, 217, 0.08)"],
};

const lightGradients: ThemeGradients = {
  hero: ["#FAFAF8", "#F4F1EA"],
  heroAlt: ["#F4F1EA", "#FAFAF8"],
  card: ["#FFFFFF", "#FAFAF8"],
  cardAlt: ["#F4F1EA", "#FFFFFF"],
  dexHero: ["#EDE9FE", "#FAFAF8"],
  dexInfo: ["#F5F3FF", "#FFFFFF"],
  profileHero: ["#FFFFFF", "#FAFAF8"],
  tabBar: ["rgba(250, 250, 248, 0.97)", "rgba(244, 241, 234, 0.95)"],
  brand: ["#8B5CF6", "#7C3AED", "#6D28D9"],
  brandSoft: ["rgba(124, 58, 237, 0.10)", "rgba(109, 40, 217, 0.05)"],
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
        ? "rgba(0, 0, 0, 0.40)"
        : "rgba(26, 24, 20, 0.08)",
      elevated: mode === "dark"
        ? "rgba(0, 0, 0, 0.60)"
        : "rgba(26, 24, 20, 0.12)",
    },
    navigation,
    statusBarStyle: mode === "dark" ? "light" : "dark",
  };
};

export const darkTheme = createTheme("dark");
export const lightTheme = createTheme("light");

export const getThemeForMode = (mode: Mode): AppTheme => (mode === "dark" ? darkTheme : lightTheme);
