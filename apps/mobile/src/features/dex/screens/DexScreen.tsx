import { useTabContentBottomInset } from "@app/hooks";
import { Feather } from "@expo/vector-icons";
import { TabScreenContainer } from "@shared/components";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const roadmapMilestones = [
  { label: "Smart-contract audits", status: "In final review" },
  { label: "Cross-chain routing", status: "Optimizing slippage" },
  { label: "Beta waitlist", status: "12,420 wallet sign-ups" },
];

const DexScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const contentBottomInset = useTabContentBottomInset();

  const handleJoinWaitlist = () => {
    Alert.alert(
      "DEX beta",
      "Thanks for your interest! We’ll notify you inside the app once the Trezo DEX beta opens.",
    );
  };

  return (
    <TabScreenContainer style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: contentBottomInset }}
        showsVerticalScrollIndicator={false}
      >
      <LinearGradient colors={gradients.dexHero} style={styles.heroCard}>
        <Text style={styles.heroLabel}>Trezo DEX</Text>
        <Text style={styles.heroTitle}>Unified liquidity across chains</Text>
        <Text style={styles.heroSubtitle}>
          Our non-custodial DEX aggregates routes, bridges, and staking vaults so every swap finds the
          best execution—no manual juggling.
        </Text>

        <TouchableOpacity activeOpacity={0.9} style={styles.ctaButton} onPress={handleJoinWaitlist}>
          <Feather name="zap" size={18} color={colors.textOnAccent} />
          <Text style={styles.ctaButtonText}>Join beta waitlist</Text>
        </TouchableOpacity>

        <View style={styles.metricsRow}>
          <View>
            <Text style={styles.metricLabel}>Projected routes</Text>
            <Text style={styles.metricValue}>5,400+</Text>
          </View>
          <View>
            <Text style={styles.metricLabel}>Liquidity sources</Text>
            <Text style={styles.metricValue}>32 pools</Text>
          </View>
          <View>
            <Text style={styles.metricLabel}>Audit partners</Text>
            <Text style={styles.metricValue}>Trail of Bits</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Roadmap</Text>
        {roadmapMilestones.map((item) => (
          <View key={item.label} style={styles.roadmapRow}>
            <View style={styles.roadmapIcon}>
              <Feather name="check-circle" color={colors.accent} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roadmapLabel}>{item.label}</Text>
              <Text style={styles.roadmapStatus}>{item.status}</Text>
            </View>
          </View>
        ))}
      </View>

      <LinearGradient colors={gradients.dexInfo} style={styles.infoCard}>
        <Text style={styles.infoTitle}>What to expect</Text>
        <View style={styles.infoRow}>
          <Feather name="shuffle" color={colors.accent} size={18} />
          <Text style={styles.infoText}>Route optimizers span Arbitrum, Base, Optimism, and Solana.</Text>
        </View>
        <View style={styles.infoRow}>
          <Feather name="key" color={colors.warning} size={18} />
          <Text style={styles.infoText}>Private key never leaves device. Hardware wallet support on roadmap.</Text>
        </View>
        <View style={styles.infoRow}>
          <Feather name="pie-chart" color={colors.accentAlt} size={18} />
          <Text style={styles.infoText}>Built-in analytics on slippage, fees, and yield vs HODL.</Text>
        </View>
      </LinearGradient>
      </ScrollView>
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    heroCard: {
      borderRadius: 28,
      padding: 24,
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.25),
      marginTop: 12,
      marginBottom: 24,
      backgroundColor: colors.surfaceElevated,
    },
    heroLabel: {
      color: colors.textMuted,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      marginTop: 12,
    },
    heroSubtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 16,
    },
    ctaButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.accent,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 16,
      marginTop: 24,
    },
    ctaButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    metricsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 28,
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 6,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 16,
    },
    roadmapRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceCard,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      marginBottom: 12,
      gap: 14,
    },
    roadmapIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.accent, 0.16),
      alignItems: "center",
      justifyContent: "center",
    },
    roadmapLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    roadmapStatus: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    infoCard: {
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: colors.surfaceCard,
      gap: 12,
    },
    infoTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 4,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    infoText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      flex: 1,
    },
  });

export default DexScreen;
