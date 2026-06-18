import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Address } from "viem";
import type { ThemeColors } from "@theme";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";
import { getNetworkConfig, type NetworkKey } from "@/src/integration/networks";
import { TokenIcon } from "@shared/components/visuals/TokenIcon";
import { AssetPickerModal, type Asset } from "@/src/shared/components/modals/AssetPickerModal";
import { useBridgeDestChains } from "../hooks/useBridgeDestChains";

// ── Exported helpers (also used by tests) ────────────────────────────────────

export function shortenAddress(address: Address | null): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Returns an error string if invalid, or null if valid. */
export function validateRecipientAddress(input: string): string | null {
  if (!input) return "Address is required";
  if (!input.startsWith("0x")) return "Address must start with 0x";
  if (!/^0x[0-9a-fA-F]{40}$/.test(input)) return "Must be a 42-character hex address";
  return null;
}

// ── Chain badge (inline copy so this component has no AssetPickerModal dep cycle) ─

function chainIconUrl(chainId: number): string | undefined {
  switch (chainId) {
    case 1: case 11155111: return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
    case 42161: return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png";
    case 8453: case 84532: return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png";
    default: return undefined;
  }
}

const ChainBadge = ({ chainId }: { chainId: number }) => {
  const uri = chainIconUrl(chainId);
  if (!uri) return null;
  return <Image source={{ uri }} style={styles.chainBadgeImg} resizeMode="contain" />;
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BridgeDestPickerProps {
  sourceNetworkKey: string;
  isMainnet: boolean;
  destNetworkKey: string | null;
  destToken: TokenMetadata | null;
  resolvedOwnAddress: Address | null;
  resolvedOwnAddressError: string | null;
  customRecipient: Address | null;
  onDestChange: (networkKey: string, token: TokenMetadata | null) => void;
  onRecipientChange: (addr: Address | null) => void;
  /** Called with the first available dest chain key when chains load and none is selected yet. */
  onDefaultChain?: (chainKey: string) => void;
  /** Formatted estimated receive amount (e.g. "0.0123"), shown inline next to the token. */
  receiveAmountDisplay?: string | null;
  /** True while the bridge quote is being fetched. */
  receiveLoading?: boolean;
  colors: ThemeColors;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BridgeDestPicker: React.FC<BridgeDestPickerProps> = ({
  sourceNetworkKey,
  isMainnet,
  destNetworkKey,
  destToken,
  resolvedOwnAddress,
  resolvedOwnAddressError,
  customRecipient,
  onDestChange,
  onRecipientChange,
  onDefaultChain,
  receiveAmountDisplay,
  receiveLoading,
  colors,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addressEditMode, setAddressEditMode] = useState(false);
  const [draftAddress, setDraftAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { destChainKeys, loading } = useBridgeDestChains(sourceNetworkKey, isMainnet);

  // Auto-pick the first available destination chain when chains load and none is selected.
  useEffect(() => {
    if (!destNetworkKey && destChainKeys.length > 0 && onDefaultChain) {
      onDefaultChain(destChainKeys[0]);
    }
  }, [destNetworkKey, destChainKeys, onDefaultChain]);

  // Combined token list for all dest chains.
  // For testnet (Across V3): exclude native tokens — only ERC-20s (WETH/USDC) are bridgeable.
  const allDestTokens = useMemo<TokenMetadata[]>(
    () => {
      const rawTokens = destChainKeys.flatMap((k) => {
        try {
          return TokenRegistryService.listSwapTokensForNetwork(k as NetworkKey);
        } catch {
          return [];
        }
      });
      if (!isMainnet) {
        return rawTokens.filter((t) => t.type !== "native");
      }
      return rawTokens;
    },
    [destChainKeys, isMainnet],
  );

  // Convert TokenMetadata → Asset for the modal
  const destAssets = useMemo<Asset[]>(
    () =>
      allDestTokens.map((t) => ({
        symbol: t.symbol,
        name: t.name,
        chainId: t.chainId,
        logo: t.logoUri,
      })),
    [allDestTokens],
  );

  // Derive dest chain display name
  const destChainName = useMemo(() => {
    if (!destNetworkKey) return null;
    try { return getNetworkConfig(destNetworkKey as NetworkKey).displayName; }
    catch { return destNetworkKey; }
  }, [destNetworkKey]);

  // Dest token chain ID (for badge)
  const destChainId = useMemo(() => {
    if (!destNetworkKey) return null;
    try { return getNetworkConfig(destNetworkKey as NetworkKey).chainId; }
    catch { return null; }
  }, [destNetworkKey]);

  const displayAddress = customRecipient ?? resolvedOwnAddress;
  const isCustom = customRecipient !== null;

  const handleBridgeSelect = useCallback(
    (asset: Asset, chainKey: string | null) => {
      // On the "All" tab no chainKey is passed, so resolve it from the tapped
      // token's chainId by matching against THIS source's actual destination
      // chains. (resolveNetworkKey() must NOT be used here: for a chainId it
      // doesn't recognise it silently returns the DEFAULT network key, which
      // routed the dest to the wrong chain and left "You receive" empty.)
      let resolvedChainKey = chainKey;
      if (!resolvedChainKey && asset.chainId !== undefined) {
        resolvedChainKey =
          destChainKeys.find((k) => {
            try {
              return getNetworkConfig(k as NetworkKey).chainId === asset.chainId;
            } catch {
              return false;
            }
          }) ?? null;
      }
      if (!resolvedChainKey) return;

      const match = allDestTokens.find(
        (t) =>
          t.symbol === asset.symbol &&
          (asset.chainId === undefined || t.chainId === asset.chainId),
      );
      onDestChange(resolvedChainKey, match ?? null);
      setPickerOpen(false);
    },
    [allDestTokens, destChainKeys, onDestChange],
  );

  const handleAddressBlur = useCallback(() => {
    const err = validateRecipientAddress(draftAddress);
    if (err) {
      setAddressError(err);
      return;
    }
    setAddressError(null);
    setAddressEditMode(false);
    onRecipientChange(draftAddress as Address);
  }, [draftAddress, onRecipientChange]);

  const handleUseMyWallet = useCallback(() => {
    setAddressEditMode(false);
    setDraftAddress("");
    setAddressError(null);
    onRecipientChange(null);
  }, [onRecipientChange]);

  const handleEditPress = useCallback(() => {
    setDraftAddress(displayAddress ?? "");
    setAddressError(null);
    setAddressEditMode(true);
  }, [displayAddress]);

  return (
    <View>
      {/* ── You receive token button ── */}
      <View style={styles.sideTopRow}>
        <Text style={[styles.sideLabel, { color: colors.textSecondary }]}>You receive</Text>
      </View>
      <View style={styles.sideRow}>
        <TouchableOpacity
          onPress={() => !loading && setPickerOpen(true)}
          style={[
            styles.tokenBtn,
            {
              backgroundColor: colors.glass,
              borderColor: colors.border,
              opacity: loading ? 0.5 : 1,
            },
          ]}
        >
          {destToken ? (
            <>
              <View style={styles.iconWrapper}>
                <TokenIcon symbol={destToken.symbol} size={26} />
                {destChainId !== null && (
                  <View style={styles.chainBadgeContainer}>
                    <ChainBadge chainId={destChainId} />
                  </View>
                )}
              </View>
              <Text style={[styles.tokenBtnSymbol, { color: colors.textPrimary }]}>
                {destToken.symbol}
              </Text>
              {destChainName && (
                <Text style={[styles.tokenBtnChain, { color: colors.textSecondary }]}>
                  · {destChainName}
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.tokenBtnSymbol, { color: colors.textMuted }]}>
              {loading ? "Loading chains…" : "Select"}
            </Text>
          )}
          <Feather name="chevron-down" size={13} color={colors.textSecondary} style={styles.chevron} />
        </TouchableOpacity>

        {/* Inline estimated receive amount — mirrors the swap "You receive" row. */}
        <View style={styles.receiveBox}>
          {receiveLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text
              style={[
                styles.receiveAmount,
                { color: receiveAmountDisplay ? colors.textPrimary : colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {receiveAmountDisplay ?? "0.00"}
            </Text>
          )}
        </View>
      </View>

      {/* ── Advanced collapsible section (recipient address) ── */}
      <TouchableOpacity
        onPress={() => setAdvancedOpen((v) => !v)}
        style={styles.advancedToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.advancedToggleText, { color: colors.textMuted }]}>Advanced</Text>
        <Feather
          name={advancedOpen ? "chevron-up" : "chevron-down"}
          size={12}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {advancedOpen && (
        <View style={styles.advancedContent}>
          {/* ── Recipient address row ── */}
          <View style={styles.recipientRow}>
            <Text style={[styles.recipientLabel, { color: colors.textMuted }]}>To</Text>
            {addressEditMode ? (
              <View style={styles.recipientEditContainer}>
                <TextInput
                  style={[
                    styles.recipientInput,
                    {
                      color: colors.textPrimary,
                      borderColor: addressError ? colors.danger : colors.border,
                      backgroundColor: colors.glass,
                    },
                  ]}
                  value={draftAddress}
                  onChangeText={setDraftAddress}
                  onBlur={handleAddressBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="0x…"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                {addressError && (
                  <Text style={[styles.recipientErrorText, { color: colors.danger }]}>
                    {addressError}
                  </Text>
                )}
                {isCustom && (
                  <TouchableOpacity onPress={handleUseMyWallet} hitSlop={8}>
                    <Text style={[styles.useMyWalletLink, { color: colors.accent }]}>
                      Use my wallet
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text
                  style={[styles.recipientAddressText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {displayAddress
                    ? shortenAddress(displayAddress)
                    : resolvedOwnAddressError
                    ? "Unresolved"
                    : "—"}
                </Text>
                <TouchableOpacity onPress={handleEditPress} hitSlop={8}>
                  <Feather name="edit-2" size={13} color={colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Custom address warning banner ── */}
          {isCustom && !addressEditMode && (
            <View
              style={[
                styles.warningBanner,
                { backgroundColor: colors.warningSoft, borderColor: `${colors.warning}66` },
              ]}
            >
              <Text style={[styles.warningBannerText, { color: colors.warning }]}>
                Sending to a custom address. Double-check it before bridging.
              </Text>
            </View>
          )}

          {/* ── Resolved address error ── */}
          {resolvedOwnAddressError && !customRecipient && (
            <View
              style={[
                styles.warningBanner,
                { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}66` },
              ]}
            >
              <Text style={[styles.warningBannerText, { color: colors.danger }]}>
                {resolvedOwnAddressError}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Asset picker modal ── */}
      <AssetPickerModal
        isVisible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={() => {}}
        onBridgeSelect={handleBridgeSelect}
        assets={destAssets}
        bridgeChainFilterKeys={destChainKeys}
        showChainFilter={false}
        title="Select Destination Token"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sideTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  sideLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  sideRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tokenBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  iconWrapper: { position: "relative", width: 26, height: 26 },
  chainBadgeContainer: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    overflow: "hidden",
  },
  chainBadgeImg: { width: 14, height: 14, borderRadius: 7 },
  tokenBtnSymbol: { fontSize: 15, fontWeight: "700" },
  tokenBtnChain: { fontSize: 12, fontWeight: "500" },
  chevron: { marginLeft: "auto" },
  receiveBox: { flex: 1, alignItems: "flex-end", justifyContent: "center", minHeight: 36 },
  receiveAmount: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  advancedToggleText: { fontSize: 12, fontWeight: "600" },
  advancedContent: { marginTop: 8 },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  recipientLabel: { fontSize: 12, fontWeight: "600" },
  recipientAddressText: { flex: 1, fontSize: 12, fontFamily: "monospace" },
  recipientEditContainer: { flex: 1, gap: 4 },
  recipientInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: "monospace",
  },
  recipientErrorText: { fontSize: 11 },
  useMyWalletLink: { fontSize: 12, fontWeight: "600" },
  warningBanner: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  warningBannerText: { fontSize: 12 },
});
