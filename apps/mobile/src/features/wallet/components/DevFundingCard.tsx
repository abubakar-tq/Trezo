import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { devFundSmartAccount, DEV_FUNDING_AMOUNT_ETH } from "@/src/features/wallet/services/devFunding";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import type { Address } from "viem";

export const DevFundingCard: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = createStyles(colors);
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const [loading, setLoading] = useState(false);

  const resolvedChainId = (aaAccount?.chainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;

  const handleFund = async () => {
    if (!smartAccountAddress) {
      Alert.alert("No Smart Account", "Deploy your smart account before sending dev funds.");
      return;
    }
    try {
      setLoading(true);
      const { transactionHash } = await devFundSmartAccount({
        address: smartAccountAddress as Address,
        chainId: resolvedChainId,
      });
      Alert.alert(
        "Dev Funding Complete",
        `Sent ${DEV_FUNDING_AMOUNT_ETH} ETH to:\n${smartAccountAddress}\n\nTx: ${transactionHash.slice(0, 12)}…`,
      );
    } catch (error) {
      Alert.alert(
        "Funding Failed",
        error instanceof Error ? error.message : "Unable to fund smart account.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Dev: Funding</Text>
      <Text style={styles.description}>
        Sends {DEV_FUNDING_AMOUNT_ETH} ETH from the local dev faucet to your smart account for demos.
      </Text>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleFund}
        disabled={loading}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>{loading ? "Funding..." : "Send Dev Funds"}</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 18,
      marginBottom: 16,
      gap: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    description: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    button: {
      marginTop: 4,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.background,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
  });
