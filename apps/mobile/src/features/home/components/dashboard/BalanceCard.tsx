import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { Badge } from '@shared/components/Tier1/Badge';
import { Sparkline } from '@shared/components';
import { FontFamilies } from '@shared/components/TokenRegistry';
import { useAppTheme } from '@theme';
import type { ThemeColors } from '@theme';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BalanceCardProps {
  balance: number;
  loading?: boolean;
  address?: string;
  isDeployed?: boolean;
  isHydrating?: boolean;
  hasLocalPasskey?: boolean | null;
  missingPrices?: string[];
  /**
   * Real portfolio 24h change in percent. Pass null when data is unknown —
   * the badge is simply omitted. Never pass a fabricated number.
   */
  change24hPct?: number | null;
  /**
   * When true, renders as a flat (non-glow) card — used for the $0 empty state.
   */
  isEmpty?: boolean;
  /**
   * 1D portfolio-value series for the sparkline. Only rendered in the funded state
   * when ≥2 finite points are present. NEVER pass data in the empty/$0 state.
   */
  sparklineData?: number[];
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
  change24hPct = null,
  isEmpty = false,
  sparklineData,
  onDeploy,
  onEnablePasskey,
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedBalance = loading
    ? "---"
    : balance >= 1e9
      ? `${(balance / 1e9).toFixed(2)}B`
      : balance >= 1e6
        ? `${(balance / 1e6).toFixed(2)}M`
        : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /**
   * Badge order of priority:
   * 1. Syncing spinner
   * 2. Enable Passkey CTA (deployed but no passkey)
   * 3. Real 24h change badge (only when change24hPct is not null)
   * 4. Activate Wallet CTA (not yet deployed)
   * — Nothing is shown when data is unknown (null) to avoid fake numbers.
   */
  const renderBadge = () => {
    if (isHydrating) {
      return <Badge status="neutral" label="Syncing..." icon={<Feather name="refresh-cw" size={10} color={colors.textSecondary} />} />;
    }
    if (isDeployed) {
      if (hasLocalPasskey === false) {
        return (
          <TouchableOpacity onPress={onEnablePasskey} activeOpacity={0.85} style={styles.ctaPill}>
            <Feather name="key" size={11} color={colors.accentAlt} />
            <Text style={[styles.ctaPillText, { color: colors.accentAlt }]}>Enable Passkey</Text>
          </TouchableOpacity>
        );
      }
      // Real 24h change — only render when we have actual data
      if (change24hPct !== null && isFinite(change24hPct) && !isEmpty) {
        const isPositive = change24hPct >= 0;
        const changeColor = isPositive ? colors.dataPositive : colors.dataNegative;
        const sign = isPositive ? "+" : "";
        return (
          <View style={styles.ctaPill}>
            <Feather
              name={isPositive ? "trending-up" : "trending-down"}
              size={11}
              color={changeColor}
            />
            <Text style={[styles.ctaPillText, { color: changeColor }]}>
              {sign}{change24hPct.toFixed(2)}%
            </Text>
          </View>
        );
      }
      // No real 24h data available — render nothing (spec: "render nothing until data exists")
      return null;
    }
    return (
      <TouchableOpacity onPress={onDeploy} activeOpacity={0.85} style={styles.ctaPill}>
        <Feather name="zap" size={11} color={colors.warning} />
        <Text style={[styles.ctaPillText, { color: colors.warning }]}>Activate Wallet</Text>
      </TouchableOpacity>
    );
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}···${address.slice(-4)}`
    : "No wallet";

  const badge = renderBadge();

  // Empty state: flat card (no glow orb, no gradient glow)
  if (isEmpty) {
    return (
      <LinearGradient
        colors={["rgba(18,15,24,0.95)", "rgba(12,10,18,0.98)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.label}>Total Balance</Text>
          {badge}
        </View>

        <View style={styles.balanceRow}>
          <Text style={styles.currency}>$</Text>
          <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            0.00
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.addressPill}>
            <Feather
              name={isDeployed ? "shield" : "alert-circle"}
              size={12}
              color={isDeployed ? "rgba(255,255,255,0.5)" : colors.warning}
            />
            <Text style={styles.addressText}>
              {isDeployed ? shortAddress : `${shortAddress} · Not deployed`}
            </Text>
          </View>
          <TouchableOpacity style={styles.copyBtn} activeOpacity={0.7} onPress={handleCopy} disabled={!address}>
            <Feather name={copied ? "check" : "copy"} size={14} color={copied ? colors.success : "rgba(255,255,255,0.5)"} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={gradients.brand as [string, string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Subtle glow orb — funded state only */}
      <View style={styles.glowOrb} />

      <View style={styles.header}>
        <Text style={styles.label}>Total Balance</Text>
        {badge}
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

      {/* Sparkline — real 1D data only; hidden when empty or <2 points (spec §5.1) */}
      {sparklineData && sparklineData.length >= 2 && !isEmpty && (
        <View style={styles.sparklineWrapper}>
          <Sparkline
            data={sparklineData}
            width={280}
            height={36}
            strokeWidth={1.5}
            fillOpacity={0.15}
            color={
              sparklineData[sparklineData.length - 1] >= sparklineData[0]
                ? colors.dataPositive
                : colors.dataNegative
            }
          />
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.addressPill}>
          <Feather
            name={isDeployed ? "shield" : "alert-circle"}
            size={12}
            color={isDeployed ? "rgba(255,255,255,0.8)" : colors.warning}
          />
          <Text style={styles.addressText}>
            {isDeployed ? shortAddress : `${shortAddress} · Not deployed`}
          </Text>
        </View>
        <TouchableOpacity style={styles.copyBtn} activeOpacity={0.7} onPress={handleCopy} disabled={!address}>
          <Feather name={copied ? "check" : "copy"} size={14} color={copied ? colors.success : "rgba(255,255,255,0.7)"} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const createStyles = (colors: ThemeColors) =>
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
      fontWeight: "300",
      fontFamily: FontFamilies.mono,
      color: "rgba(255,255,255,0.65)",
      marginRight: 4,
    },
    balance: {
      fontSize: 46,
      // Spec §5.1: "light weight (300)" + mono font for balance number
      fontWeight: "300",
      fontFamily: FontFamilies.mono,
      letterSpacing: -1,
      // Must be light in BOTH themes — sits on the violet brand gradient.
      color: colors.textOnAccent,
    },
    missingNote: {
      fontSize: 11,
      color: "rgba(255,255,255,0.45)",
      marginTop: 2,
    },
    sparklineWrapper: {
      marginTop: 12,
      alignSelf: "stretch",
      opacity: 0.8,
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
      // Spec §3: radius scale — 12 for pills/token-chips
      borderRadius: 12,
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
      // Spec §3: 999 for circular/icon buttons
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    ctaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
      backgroundColor: "rgba(255,255,255,0.10)",
    },
    ctaPillText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
  });
