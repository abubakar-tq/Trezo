import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from '@shared/components/Tier1/Badge';
import { useAppTheme } from '@theme';
import type { ThemeColors } from '@theme';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BalanceCardProps {
  balance: number;
  loading?: boolean;
  address?: string;
  isDeployed?: boolean;
  isHydrating?: boolean;
  hasLocalPasskey?: boolean | null;
  missingPrices?: string[];
  onDeploy?: () => void;
  onEnablePasskey?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  loading,
  address,
  isDeployed = true,
  isHydrating = false,
  hasLocalPasskey = null,
  missingPrices,
  onDeploy,
  onEnablePasskey,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formattedBalance = loading
    ? "---"
    : balance >= 1e9
      ? `${(balance / 1e9).toFixed(2)}B`
      : balance >= 1e6
        ? `${(balance / 1e6).toFixed(2)}M`
        : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderBadge = () => {
    if (isHydrating) {
      return <Badge status="neutral" label="Syncing..." icon={<Feather name="refresh-cw" size={10} color={colors.textSecondary} />} />;
    }
    if (isDeployed) {
      if (hasLocalPasskey === false) {
        return (
          <TouchableOpacity onPress={onEnablePasskey} activeOpacity={0.8}>
            <Badge status="accent" label="Enable Passkey" icon={<Feather name="key" size={10} color={colors.accent} />} />
          </TouchableOpacity>
        );
      }
      return <Badge status="success" label="+4.2%" icon={<Feather name="trending-up" size={10} color={colors.success} />} />;
    }
    return (
      <TouchableOpacity onPress={onDeploy} activeOpacity={0.8}>
        <Badge status="warning" label="Activate Wallet" icon={<Feather name="zap" size={10} color={colors.warning} />} />
      </TouchableOpacity>
    );
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}···${address.slice(-4)}`
    : "No wallet";

  return (
    <LinearGradient
      colors={["#8B5CF6", "#7C3AED", "#6027D9"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.glowOrb} />

      <View style={styles.header}>
        <Text style={styles.label}>Total Balance</Text>
        {renderBadge()}
      </View>

      <View style={styles.balanceRow}>
        <Text style={styles.currency}>$</Text>
        <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {formattedBalance}
        </Text>
      </View>

      {missingPrices && missingPrices.length > 0 && (
        <Text style={styles.missingNote}>
          USD unavailable for {missingPrices.length} token{missingPrices.length === 1 ? "" : "s"}
        </Text>
      )}

      <View style={styles.footer}>
        <View style={styles.addressPill}>
          <Feather
            name={isDeployed ? "shield" : "alert-circle"}
            size={12}
            color={isDeployed ? "rgba(255,255,255,0.8)" : "#F59E0B"}
          />
          <Text style={styles.addressText}>
            {isDeployed ? shortAddress : `${shortAddress} · Not deployed`}
          </Text>
        </View>
        <TouchableOpacity style={styles.copyBtn} activeOpacity={0.7}>
          <Feather name="copy" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const createStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      borderRadius: 28,
      padding: 24,
      overflow: "hidden",
      position: "relative",
    },
    glowOrb: {
      position: "absolute",
      top: -50,
      right: -50,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    label: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.6)",
    },
    balanceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: 4,
    },
    currency: {
      fontSize: 26,
      fontWeight: "700",
      color: "rgba(255,255,255,0.65)",
      marginRight: 4,
    },
    balance: {
      fontSize: 46,
      fontWeight: "800",
      letterSpacing: -1,
      color: "#FFFFFF",
    },
    missingNote: {
      fontSize: 11,
      color: "rgba(255,255,255,0.45)",
      marginTop: 2,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.12)",
    },
    addressPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(255,255,255,0.12)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    addressText: {
      fontSize: 12,
      fontWeight: "700",
      color: "rgba(255,255,255,0.85)",
      letterSpacing: 0.3,
    },
    copyBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
  });
