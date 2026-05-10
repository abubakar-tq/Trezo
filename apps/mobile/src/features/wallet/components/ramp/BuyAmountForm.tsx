/**
 * BuyAmountForm.tsx
 *
 * The input form for the buy screen.
 * Handles amount entry, asset selection, provider toggle, and Transak network selection.
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
import type { RampProvider, TransakNetwork } from "@/src/types/ramp";
import { TRANSAK_NETWORKS } from "@/src/types/ramp";

interface Props {
  amount: string;
  selectedAsset: Asset;
  estimatedCrypto: string;
  provider: RampProvider;
  transakNetwork: TransakNetwork;
  targetAddress: string;
  displayAddress: string;
  onAmountChange: (v: string) => void;
  onAssetPress: () => void;
  onAccountPress: () => void;
  onProviderChange: (p: RampProvider) => void;
  onNetworkChange: (n: TransakNetwork) => void;
}

export const BuyAmountForm: React.FC<Props> = ({
  amount,
  selectedAsset,
  estimatedCrypto,
  provider,
  transakNetwork,
  targetAddress,
  displayAddress,
  onAmountChange,
  onAssetPress,
  onAccountPress,
  onProviderChange,
  onNetworkChange,
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

      {/* Provider Mode Selector */}
      <View style={styles.providerSection}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MODE</Text>
        <View style={[styles.toggle, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          {(["mock", "transak"] as RampProvider[]).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => onProviderChange(p)}
              style={[
                styles.toggleTab,
                provider === p && { backgroundColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.toggleTabText,
                  { color: provider === p ? colors.textOnAccent : colors.textSecondary },
                ]}
              >
                {p === "mock" ? "Local Mock" : "Transak"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.providerHint, { color: colors.textMuted }]}>
          {provider === "mock"
            ? "Funds sent directly from Anvil wallet"
            : "Real KYC + card payment via Transak"}
        </Text>
      </View>

      {/* Network Selector — only shown for Transak */}
      {provider === "transak" && (
        <View style={styles.networkSection}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TESTNET</Text>
          <View style={styles.networkRow}>
            {(Object.entries(TRANSAK_NETWORKS) as [TransakNetwork, typeof TRANSAK_NETWORKS[TransakNetwork]][]).map(
              ([key, cfg]) => {
                const isSelected = transakNetwork === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => onNetworkChange(key)}
                    style={[
                      styles.networkChip,
                      {
                        backgroundColor: isSelected ? `${cfg.color}22` : colors.surfaceCard,
                        borderColor: isSelected ? cfg.color : colors.border,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.networkDot,
                        { backgroundColor: cfg.color },
                      ]}
                    />
                    <Text
                      style={[
                        styles.networkLabel,
                        { color: isSelected ? cfg.color : colors.textSecondary },
                      ]}
                    >
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
          <Text style={[styles.networkHint, { color: colors.textMuted }]}>
            Receives TRNSK test token on {TRANSAK_NETWORKS[transakNetwork].testnetName}
          </Text>
        </View>
      )}
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
  providerSection: { alignItems: "center", gap: 8, width: "100%" },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  toggle: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    width: 220,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTabText: { fontSize: 13, fontWeight: "700" },
  providerHint: { fontSize: 11, fontWeight: "500", textAlign: "center", maxWidth: 260 },
  networkSection: { alignItems: "center", gap: 10, marginTop: 20, width: "100%" },
  networkRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  networkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  networkDot: { width: 7, height: 7, borderRadius: 4 },
  networkLabel: { fontSize: 12, fontWeight: "700" },
  networkHint: { fontSize: 11, fontWeight: "500", textAlign: "center", maxWidth: 260 },
});
