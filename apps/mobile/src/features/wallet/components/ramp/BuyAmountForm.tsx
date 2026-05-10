/**
 * BuyAmountForm.tsx
 *
 * The input form for the buy screen.
 * Handles amount entry and asset selection.
 */
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { Asset } from "@shared/components/modals/AssetPickerModal";

interface Props {
  amount: string;
  selectedAsset: Asset;
  estimatedCrypto: string;
  targetAddress: string;
  displayAddress: string;
  onAmountChange: (v: string) => void;
  onAssetPress: () => void;
  onAccountPress: () => void;
}

export const BuyAmountForm: React.FC<Props> = ({
  amount,
  selectedAsset,
  estimatedCrypto,
  targetAddress,
  displayAddress,
  onAmountChange,
  onAssetPress,
  onAccountPress,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const hasAddress = Boolean(targetAddress);

  return (
    <View style={styles.container}>
      {/* Wallet Row */}
      <TouchableOpacity
        onPress={onAccountPress}
        style={[
          styles.accountCard,
          { backgroundColor: colors.surfaceCard },
          !hasAddress && { borderColor: colors.danger, borderWidth: 1 },
        ]}
      >
        <View style={styles.accountLeft}>
          <View
            style={[
              styles.dot,
              { backgroundColor: hasAddress ? colors.success : colors.danger },
            ]}
          />
          <View>
            <Text style={[styles.accountLabel, { color: colors.textPrimary }]}>
              Receiving Wallet
            </Text>
            {!hasAddress && (
              <Text style={[styles.accountWarning, { color: colors.danger }]}>
                No wallet address found
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.addressText, { color: hasAddress ? colors.textMuted : colors.danger }]}>
          {displayAddress}
        </Text>
      </TouchableOpacity>

      {/* Amount Entry */}
      <View style={styles.amountSection}>
        <View style={styles.amountRow}>
          <Text style={[styles.currencySymbol, { color: colors.textPrimary }]}>$</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.textPrimary }]}
            value={amount}
            onChangeText={onAmountChange}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            maxLength={7}
            autoFocus
          />
        </View>
        <Text style={[styles.estimatedCrypto, { color: colors.textMuted }]}>
          ≈ {estimatedCrypto} {selectedAsset.symbol}
        </Text>
      </View>

      {/* Asset Chip */}
      <TouchableOpacity
        style={[styles.assetChip, { backgroundColor: `${colors.accent}1A` }]}
        onPress={onAssetPress}
      >
        {selectedAsset.logo ? (
          <Image source={{ uri: selectedAsset.logo }} style={styles.assetLogo} />
        ) : (
          <View style={[styles.assetLogoFallback, { backgroundColor: `${colors.accent}33` }]}>
            <Text style={[styles.assetLogoFallbackText, { color: colors.accent }]}>
              {selectedAsset.symbol[0]}
            </Text>
          </View>
        )}
        <Text style={[styles.assetSymbol, { color: colors.accent }]}>{selectedAsset.symbol}</Text>
        <Feather name="chevron-down" size={14} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    marginBottom: 36,
    width: "100%",
  },
  accountLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  accountLabel: { fontSize: 14, fontWeight: "600" },
  accountWarning: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  addressText: { fontSize: 13, fontWeight: "500" },
  amountSection: { alignItems: "center", marginBottom: 4 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  currencySymbol: { fontSize: 32, fontWeight: "500", marginTop: 10 },
  amountInput: { fontSize: 72, fontWeight: "800", textAlign: "center", minWidth: 80 },
  estimatedCrypto: { fontSize: 16, fontWeight: "500", marginTop: 6 },
  assetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 30,
    marginTop: 20,
    marginBottom: 32,
  },
  assetLogo: { width: 22, height: 22, borderRadius: 11 },
  assetLogoFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  assetLogoFallbackText: { fontSize: 12, fontWeight: "800" },
  assetSymbol: { fontSize: 16, fontWeight: "800" },
});
