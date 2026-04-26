import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme } from "@react-navigation/native";

import { withAlpha } from "@utils/color";

import type { AppTheme, Mode, ThemeColors, ThemeGradients } from "./types";

const darkColors: ThemeColors = {
  background: "#04030a",
  surface: "rgba(12, 10, 18, 0.92)", // Added missing surface color
  surfaceCard: "rgba(12, 10, 18, 0.92)",
  surfaceElevated: "rgba(15, 23, 42, 0.9)",
  surfaceMuted: "rgba(12, 10, 18, 0.85)",
  border: "rgba(255,255,255,0.08)",
  borderMuted: "rgba(255,255,255,0.05)",
  text: "#f9fafb", // Added missing text color
  textPrimary: "#f9fafb",
  textSecondary: "#cbd5f5",
  secondaryText: "#cbd5f5", // Added missing secondaryText color
  textMuted: "#94a3b8",
  textOnAccent: "#ffffff", // Changed to white as accent is usually vibrant
  textOnHero: "#f9fafb",
  accent: "#A855F7", // Purple
  accentAlt: "#8B5CF6", // Violet
  success: "#22c55e",
  warning: "#facc15",
  danger: "#f43f5e",
};

const lightColors: ThemeColors = {
  background: "#f7f9fc",
  surface: "#ffffff", // Added missing surface color
  surfaceCard: "#ffffff",
  surfaceElevated: "#edf2ff",
  surfaceMuted: "#f1f5f9",
  border: "rgba(15,23,42,0.12)",
  borderMuted: "rgba(15,23,42,0.06)",
  text: "#0f172a", // Added missing text color
  textPrimary: "#0f172a",
  textSecondary: "#1e293b",
  secondaryText: "#1e293b", // Added missing secondaryText color
  textMuted: "#64748b",
  textOnAccent: "#ffffff",
  textOnHero: "#0f172a",
  accent: "#7C3AED", // Indigo
  accentAlt: "#A855F7", // Purple
  success: "#16a34a",
  warning: "#ca8a04",
  danger: "#dc2626",
};

const darkGradients: ThemeGradients = {
  hero: ["#2e1065", "#04030a"], // Deep Purple to Black
  heroAlt: ["#4c1d95", "#04030a"], // Violet to Black
  card: ["#1e1b4b", "#04030a"],
  cardAlt: ["#1e1b4b", "#0f172a"],
  dexHero: ["#2e1065", "#020617"],
  dexInfo: ["#1e1b4b", "#0b1120"],
  profileHero: ["#4c1d95", "#04030a"],
  tabBar: ["rgba(12,10,18,0.96)", "rgba(15,23,42,0.85)"],
};

const lightGradients: ThemeGradients = {
  hero: ["#e0e7ff", "#f8fafc"],
  heroAlt: ["#e8f5ff", "#fefefe"],
  card: ["#f5f8ff", "#eef2ff"],
  cardAlt: ["#f1f5f9", "#f8fafc"],
  dexHero: ["#e0f2ff", "#f8fafc"],
  dexInfo: ["#f1f5f9", "#ffffff"],
  profileHero: ["#e4ecff", "#f9fbff"],
  tabBar: ["rgba(226,232,240,0.95)", "rgba(241,245,249,0.9)"],
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
      card: withAlpha(mode === "dark" ? "#000000" : "#94a3b8", mode === "dark" ? 0.35 : 0.18),
      elevated: withAlpha(mode === "dark" ? "#020617" : "#94a3b8", mode === "dark" ? 0.45 : 0.22),
    },
    navigation,
    statusBarStyle: mode === "dark" ? "light" : "dark",
  };
};

export const darkTheme = createTheme("dark");
export const lightTheme = createTheme("light");

export const getThemeForMode = (mode: Mode): AppTheme => (mode === "dark" ? darkTheme : lightTheme);
