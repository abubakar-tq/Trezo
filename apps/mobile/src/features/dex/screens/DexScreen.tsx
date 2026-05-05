import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatUnits, parseUnits, type Address } from "viem";

import { BalanceService } from "@/src/features/assets/services/BalanceService";
import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import { AllowanceService } from "@/src/features/swaps/services/AllowanceService";
import { SwapExecutionService } from "@/src/features/swaps/services/SwapExecutionService";
import { SwapPreparationService } from "@/src/features/swaps/services/SwapPreparationService";
import { SwapQuoteService } from "@/src/features/swaps/services/SwapQuoteService";
import type { SwapPlan, SwapQuote } from "@/src/features/swaps/types/swap";
import WalletPersistenceService from "@/src/features/wallet/services/SupabaseWalletService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { getEnabledChains, type SupportedChainId } from "@/src/integration/chains";
import { resolveNetworkKey, getNetworkConfig } from "@/src/integration/networks";
import { useUserStore } from "@/src/store/useUserStore";
import { TabScreenContainer, MeshBackground, TokenIcon, AssetPickerModal, type Asset } from "@shared/components";
import { useTabContentBottomInset } from "@hooks";

type DexTab = "swap" | "bridge";

type UiState =
  | "idle"
  | "validating"
  | "quoting"
  | "quote_ready"
  | "approval_required"
  | "signing_approval"
  | "approval_pending"
  | "signing_swap"
  | "swap_pending"
  | "confirmed"
  | "failed"
  | "cancelled";

const SLIPPAGE_PRESETS = ["0.3", "0.5", "1.0"] as const;
const DEFAULT_QUOTE_DEBOUNCE_MS = 500;

const shorten = (value?: string | null): string => {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const toTokenKey = (token: TokenMetadata | null): string | null => {
  if (!token) return null;
  return token.type === "native" ? "native" : token.address.toLowerCase();
};

const toAsset = (token: TokenMetadata, balanceRaw: bigint): Asset => ({
  symbol: token.symbol,
  name: token.name,
  balance: formatUnits(balanceRaw, token.decimals),
  usd_value: 0,
});

const parseSlippageBps = (pct: string): number => {
  const parsed = parseFloat(pct.trim());
  if (isNaN(parsed) || parsed <= 0 || parsed > 50) {
    throw new Error("Slippage must be between 0.01% and 50%.");
  }
  return Math.round(parsed * 100);
};

export const DexScreen: React.FC = () => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const contentBottomInset = useTabContentBottomInset();

  const isDark = resolvedMode === "dark";
  const glassBackground = isDark ? "rgba(22, 22, 22, 0.7)" : "#FFFFFF";

  const user = useUserStore((state) => state.user);
  const activeChainId = useWalletStore((state) => state.activeChainId);
  const aaAccount = useWalletStore((state) => state.aaAccount);

  const enabledChains = useMemo(() => getEnabledChains(), []);

  const [activeTab, setActiveTab] = useState<DexTab>("swap");
  const [selectedChainId, setSelectedChainId] = useState<SupportedChainId>(
    (aaAccount?.chainId as SupportedChainId | undefined)
      ?? (activeChainId as SupportedChainId | undefined)
      ?? (enabledChains[0]?.id as SupportedChainId | undefined)
      ?? 31337,
  );

  const [sellToken, setSellToken] = useState<TokenMetadata | null>(null);
  const [buyToken, setBuyToken] = useState<TokenMetadata | null>(null);
  const [sellAmountDecimal, setSellAmountDecimal] = useState<string>("");
  const [slippagePct, setSlippagePct] = useState<string>("0.5");
  const [customSlippageActive, setCustomSlippageActive] = useState<boolean>(false);

  const [walletId, setWalletId] = useState<string | null>(aaAccount?.id ?? null);
  const [walletAddress, setWalletAddress] = useState<Address | null>(
    (aaAccount?.predictedAddress as Address | undefined) ?? null,
  );

  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({});
  const [balancesLoading, setBalancesLoading] = useState<boolean>(false);

  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [approvalRequired, setApprovalRequired] = useState<boolean>(false);
  const [preparedPlan, setPreparedPlan] = useState<SwapPlan | null>(null);
  const [uiState, setUiState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isAssetPickerVisible, setIsAssetPickerVisible] = useState(false);
  const [assetPickerSide, setAssetPickerSide] = useState<"sell" | "buy">("sell");

  const networkKey = useMemo(() => resolveNetworkKey(selectedChainId), [selectedChainId]);

  const networkConfig = useMemo(() => {
    try { return getNetworkConfig(networkKey); } catch { return null; }
  }, [networkKey]);

  const swapTokens = useMemo(
    () => TokenRegistryService.listSwapTokensForNetwork(networkKey),
    [networkKey],
  );

  const sellTokenBalanceRaw = useMemo(() => {
    const key = toTokenKey(sellToken);
    return key ? (tokenBalances[key] ?? 0n) : 0n;
  }, [sellToken, tokenBalances]);

  const sellTokenBalanceDisplay = useMemo(() => {
    if (!sellToken) return "0";
    return BalanceService.formatBalance(sellToken, sellTokenBalanceRaw);
  }, [sellToken, sellTokenBalanceRaw]);

  const providerCount = useMemo(
    () => SwapQuoteService.getProvidersForChain(selectedChainId).length,
    [selectedChainId],
  );

  const assetPickerList = useMemo(
    () => swapTokens.map((token) => toAsset(token, tokenBalances[toTokenKey(token) ?? "native"] ?? 0n)),
    [swapTokens, tokenBalances],
  );

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  useEffect(() => {
    if (!swapTokens.length) {
      setSellToken(null);
      setBuyToken(null);
      return;
    }

    if (!sellToken || !swapTokens.some((token) => toTokenKey(token) === toTokenKey(sellToken))) {
      setSellToken(swapTokens[0]);
    }

    if (!buyToken || !swapTokens.some((token) => toTokenKey(token) === toTokenKey(buyToken))) {
      setBuyToken(swapTokens.length > 1 ? swapTokens[1] : swapTokens[0]);
    }
  }, [buyToken, sellToken, swapTokens]);

  useEffect(() => {
    let cancelled = false;

    const loadWallet = async () => {
      if (!user?.id) {
        setWalletId(null);
        setWalletAddress(null);
        return;
      }

      const walletService = new WalletPersistenceService();
      const wallet = await walletService.getAAWalletForChain(user.id, selectedChainId);
      if (cancelled) return;

      setWalletId(wallet?.id ?? null);
      setWalletAddress((wallet?.predicted_address as Address | undefined) ?? null);
    };

    loadWallet().catch((error) => {
      if (cancelled) return;
      setErrorMessage(error instanceof Error ? error.message : "Failed to load wallet for chain.");
    });

    return () => {
      cancelled = true;
    };
  }, [selectedChainId, user?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadBalances = async () => {
      if (!walletAddress || !swapTokens.length) {
        setTokenBalances({});
        return;
      }

      setBalancesLoading(true);
      try {
        const entries = await Promise.all(
          swapTokens.map(async (token) => {
            const key = toTokenKey(token) ?? "native";
            const balance = await BalanceService.getBalance({
              chainId: selectedChainId,
              walletAddress,
              token,
            });
            return [key, balance] as const;
          }),
        );

        if (!cancelled) {
          setTokenBalances(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to fetch token balances.");
          setTokenBalances({});
        }
      } finally {
        if (!cancelled) {
          setBalancesLoading(false);
        }
      }
    };

    loadBalances();

    return () => {
      cancelled = true;
    };
  }, [selectedChainId, swapTokens, walletAddress]);

  useEffect(() => {
    let cancelled = false;
    setPreparedPlan(null);

    if (!walletAddress || !sellToken || !buyToken) {
      setQuote(null);
      setApprovalRequired(false);
      setUiState("idle");
      return () => {
        cancelled = true;
      };
    }

    if (!sellAmountDecimal.trim()) {
      setQuote(null);
      setApprovalRequired(false);
      setUiState("idle");
      return () => {
        cancelled = true;
      };
    }

    if (toTokenKey(sellToken) === toTokenKey(buyToken)) {
      setQuote(null);
      setApprovalRequired(false);
      setErrorMessage("Sell and buy tokens must be different.");
      return () => {
        cancelled = true;
      };
    }

    const debounce = setTimeout(async () => {
      if (cancelled) return;
      setErrorMessage(null);
      setUiState("quoting");

      try {
        const slippageBps = parseSlippageBps(slippagePct);
        const sellAmountRaw = parseUnits(sellAmountDecimal, sellToken.decimals);
        if (sellAmountRaw <= 0n) {
          throw new Error("Sell amount must be greater than zero.");
        }

        const nextQuote = await SwapQuoteService.getQuote({
          chainId: selectedChainId,
          account: walletAddress,
          sellToken,
          buyToken,
          sellAmountRaw,
          slippageBps,
        });

        const allowance = await AllowanceService.isApprovalRequired({
          chainId: selectedChainId,
          token: sellToken,
          sellAmountRaw,
          owner: walletAddress,
          spender: nextQuote.spender,
        });

        if (cancelled) return;

        setQuote(nextQuote);
        setApprovalRequired(allowance.required);
        setUiState(allowance.required ? "approval_required" : "quote_ready");
      } catch (error) {
        if (cancelled) return;
        setQuote(null);
        setApprovalRequired(false);
        setUiState("idle");
        setErrorMessage(error instanceof Error ? error.message : "Failed to fetch swap quote.");
      }
    }, DEFAULT_QUOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [buyToken, selectedChainId, sellAmountDecimal, sellToken, slippagePct, walletAddress]);

  const buildIntent = (): {
    userId: string;
    aaWalletId: string;
    walletAddress: Address;
    chainId: SupportedChainId;
    sellToken: TokenMetadata;
    buyToken: TokenMetadata;
    sellAmountDecimal: string;
    slippageBps: number;
  } | null => {
    if (!user?.id || !walletId || !walletAddress || !sellToken || !buyToken) {
      return null;
    }

    return {
      userId: user.id,
      aaWalletId: walletId,
      walletAddress,
      chainId: selectedChainId,
      sellToken,
      buyToken,
      sellAmountDecimal: sellAmountDecimal.trim(),
      slippageBps: parseSlippageBps(slippagePct),
    };
  };

  const handleTokenSelect = (asset: Asset) => {
    const next = swapTokens.find((token) => token.symbol === asset.symbol);
    if (!next) return;

    if (assetPickerSide === "sell") {
      if (buyToken && toTokenKey(next) === toTokenKey(buyToken)) {
        setBuyToken(sellToken);
      }
      setSellToken(next);
    } else {
      if (sellToken && toTokenKey(next) === toTokenKey(sellToken)) {
        setSellToken(buyToken);
      }
      setBuyToken(next);
    }
  };

  const handleSwapDirection = () => {
    if (!sellToken || !buyToken) return;
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setPreparedPlan(null);
  };

  const handleReviewSwap = async () => {
    const intent = buildIntent();
    if (!intent) {
      setErrorMessage("Missing user or wallet context for swap.");
      return;
    }

    setErrorMessage(null);
    setUiState("validating");

    try {
      const plan = await SwapPreparationService.prepareSwap(intent);
      setPreparedPlan(plan);
      setUiState(plan.approvalRequired ? "approval_required" : "quote_ready");
    } catch (error) {
      setPreparedPlan(null);
      setUiState("failed");
      setErrorMessage(error instanceof Error ? error.message : "Failed to prepare swap.");
    }
  };

  const handleExecuteSwap = async () => {
    const intent = buildIntent();
    if (!intent) {
      setErrorMessage("Missing user or wallet context for swap.");
      return;
    }

    setErrorMessage(null);
    setUiState(preparedPlan?.approvalRequired ? "signing_approval" : "signing_swap");

    try {
      const result = await SwapExecutionService.executeSwap(intent, {
        waitForReceipt: true,
        receiptTimeoutMs: 60_000,
        receiptPollIntervalMs: 2_000,
      });

      if (result.status === "confirmed") {
        setUiState("confirmed");
      } else if (result.status === "pending") {
        setUiState(result.swapTransactionId ? "swap_pending" : "approval_pending");
      } else if (result.status === "cancelled") {
        setUiState("cancelled");
      } else {
        setUiState("failed");
      }

      const transactionId = result.swapTransactionId ?? result.approvalTransactionId;
      if (transactionId) {
        navigation.navigate("TransactionStatus", { transactionId });
      }

      if (result.error) {
        setErrorMessage(result.error);
      }
    } catch (error) {
      setUiState("failed");
      setErrorMessage(error instanceof Error ? error.message : "Swap execution failed.");
    }
  };

  const isQuoteLoading = uiState === "quoting";
  const isValidating = uiState === "validating";
  const quoteReady = Boolean(quote);
  const canReview = Boolean(
    user?.id
      && walletId
      && walletAddress
      && sellToken
      && buyToken
      && sellAmountDecimal.trim().length > 0
      && quoteReady,
  );
  const canExecute = Boolean(preparedPlan);

  return (
    <TabScreenContainer includeBottomInset>
      <MeshBackground intensity={0.8} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: contentBottomInset + 40,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Exchange</Text>
          <View style={styles.headerMeta}>
            {(() => {
              const env = networkConfig?.environment ?? "local";
              const dotColor =
                env === "mainnet" ? colors.accent
                : env === "local_fork" ? "#F59E0B"
                : env === "testnet" ? "#A78BFA"
                : colors.success;
              const displayName = networkConfig?.displayName ?? `Chain ${selectedChainId}`;
              return (
                <View style={[styles.networkBadge, { backgroundColor: withAlpha(dotColor, 0.1), borderColor: withAlpha(dotColor, 0.28) }]}>
                  <View style={[styles.networkDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.networkBadgeText, { color: dotColor }]}>{displayName}</Text>
                </View>
              );
            })()}
            {walletAddress && (
              <Text style={[styles.walletAddressText, { color: colors.textSecondary }]}>
                {shorten(walletAddress)}
              </Text>
            )}
          </View>
        </View>

        {/* Swap / Bridge tabs */}
        <View style={[styles.tabContainer, { backgroundColor: withAlpha(colors.surfaceCard, 0.9) }]}>
          <TouchableOpacity
            onPress={() => setActiveTab("swap")}
            style={[styles.tab, activeTab === "swap" && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.tabText, { color: activeTab === "swap" ? colors.textOnAccent : colors.textSecondary }]}>
              Swap
            </Text>
          </TouchableOpacity>
          <TouchableOpacity disabled style={[styles.tab, { opacity: 0.4 }]}>
            <Text style={[styles.tabText, { color: colors.textSecondary }]}>Bridge (soon)</Text>
          </TouchableOpacity>
        </View>

        {/* Network selection */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chainRow}
        >
          {enabledChains.map((chain) => {
            const isActive = chain.id === selectedChainId;
            return (
              <TouchableOpacity
                key={chain.id}
                style={[
                  styles.chainChip,
                  {
                    backgroundColor: isActive ? withAlpha(colors.accent, 0.18) : withAlpha(colors.surfaceCard, 0.85),
                    borderColor: isActive ? withAlpha(colors.accent, 0.5) : withAlpha(colors.border, 0.35),
                  },
                ]}
                onPress={() => {
                  setSelectedChainId(chain.id as SupportedChainId);
                  setPreparedPlan(null);
                  setErrorMessage(null);
                }}
              >
                <Text style={[styles.chainChipText, { color: isActive ? colors.accent : colors.textSecondary }]}>
                  {chain.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Swap card */}
        <View style={[styles.mainCard, { backgroundColor: glassBackground, borderColor: withAlpha(colors.border, 0.5) }]}>
          {/* Sell side */}
          <View style={styles.swapSide}>
            <View style={styles.swapSideHeader}>
              <Text style={[styles.swapSideLabel, { color: colors.textSecondary }]}>You pay</Text>
              <Text style={[styles.balanceHint, { color: colors.textSecondary }]}>
                Bal:{" "}
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                  {sellTokenBalanceDisplay} {sellToken?.symbol ?? ""}
                </Text>
              </Text>
            </View>
            <View style={styles.swapSideRow}>
              <TouchableOpacity
                style={[styles.tokenButton, { backgroundColor: withAlpha(colors.textPrimary, 0.06), borderColor: withAlpha(colors.border, 0.25) }]}
                onPress={() => { setAssetPickerSide("sell"); setIsAssetPickerVisible(true); }}
              >
                <TokenIcon symbol={sellToken?.symbol ?? "?"} size={26} />
                <Text style={[styles.tokenButtonSymbol, { color: colors.textPrimary }]}>
                  {sellToken?.symbol ?? "Select"}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.amountInput, { color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={withAlpha(colors.textPrimary, 0.18)}
                keyboardType="decimal-pad"
                value={sellAmountDecimal}
                onChangeText={setSellAmountDecimal}
              />
            </View>
          </View>

          {/* Swap direction divider */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: withAlpha(colors.border, 0.5) }]} />
            <TouchableOpacity
              style={[styles.swapDirectionBtn, { backgroundColor: colors.surfaceCard, borderColor: withAlpha(colors.border, 0.5) }]}
              onPress={handleSwapDirection}
            >
              <Ionicons name="swap-vertical" size={17} color={colors.accent} />
            </TouchableOpacity>
            <View style={[styles.dividerLine, { backgroundColor: withAlpha(colors.border, 0.5) }]} />
          </View>

          {/* Buy side */}
          <View style={styles.swapSide}>
            <View style={styles.swapSideHeader}>
              <Text style={[styles.swapSideLabel, { color: colors.textSecondary }]}>You receive</Text>
              <Text style={[styles.balanceHint, { color: colors.textSecondary }]}>
                {providerCount > 0 ? `${providerCount} provider${providerCount !== 1 ? "s" : ""}` : "No providers configured"}
              </Text>
            </View>
            <View style={styles.swapSideRow}>
              <TouchableOpacity
                style={[styles.tokenButton, { backgroundColor: withAlpha(colors.textPrimary, 0.06), borderColor: withAlpha(colors.border, 0.25) }]}
                onPress={() => { setAssetPickerSide("buy"); setIsAssetPickerVisible(true); }}
              >
                <TokenIcon symbol={buyToken?.symbol ?? "?"} size={26} />
                <Text style={[styles.tokenButtonSymbol, { color: colors.textPrimary }]}>
                  {buyToken?.symbol ?? "Select"}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.receiveAmountBox}>
                {isQuoteLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={[styles.receiveAmount, { color: quote ? colors.textPrimary : withAlpha(colors.textPrimary, 0.2) }]}>
                    {quote ? formatUnits(quote.estimatedBuyAmountRaw, quote.buyToken.decimals) : "0.00"}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Details / slippage card */}
        <View style={[styles.detailsCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.5), borderColor: withAlpha(colors.border, 0.4) }]}>

          {/* Slippage */}
          <View style={styles.slippageSection}>
            <View style={styles.slippageTitleRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Max Slippage</Text>
              <Text style={[styles.slippageCurrentPct, { color: colors.textPrimary }]}>{slippagePct}%</Text>
            </View>
            <View style={styles.slippagePresets}>
              {SLIPPAGE_PRESETS.map((preset) => {
                const isSelected = !customSlippageActive && slippagePct === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => { setSlippagePct(preset); setCustomSlippageActive(false); }}
                    style={[
                      styles.slippagePresetBtn,
                      {
                        backgroundColor: isSelected ? withAlpha(colors.accent, 0.14) : withAlpha(colors.surfaceCard, 0.7),
                        borderColor: isSelected ? colors.accent : withAlpha(colors.border, 0.4),
                      },
                    ]}
                  >
                    <Text style={[styles.slippagePresetText, { color: isSelected ? colors.accent : colors.textSecondary }]}>
                      {preset}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => setCustomSlippageActive(true)}
                style={[
                  styles.slippagePresetBtn,
                  {
                    backgroundColor: customSlippageActive ? withAlpha(colors.accent, 0.14) : withAlpha(colors.surfaceCard, 0.7),
                    borderColor: customSlippageActive ? colors.accent : withAlpha(colors.border, 0.4),
                  },
                ]}
              >
                <Text style={[styles.slippagePresetText, { color: customSlippageActive ? colors.accent : colors.textSecondary }]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>
            {customSlippageActive && (
              <View style={[styles.customSlippageRow, { backgroundColor: withAlpha(colors.surfaceCard, 0.7), borderColor: withAlpha(colors.border, 0.4) }]}>
                <TextInput
                  style={[styles.customSlippageInput, { color: colors.textPrimary }]}
                  value={slippagePct}
                  onChangeText={setSlippagePct}
                  keyboardType="decimal-pad"
                  placeholder="0.5"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <Text style={[styles.customSlippageSuffix, { color: colors.textSecondary }]}>%</Text>
              </View>
            )}
          </View>

          {/* Quote details — only shown when quote is available */}
          {quote && (
            <>
              <View style={[styles.sectionDivider, { backgroundColor: withAlpha(colors.border, 0.4) }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Estimated receive</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {formatUnits(quote.estimatedBuyAmountRaw, quote.buyToken.decimals)} {quote.buyToken.symbol}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Minimum receive</Text>
                <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                  {formatUnits(quote.minimumBuyAmountRaw, quote.buyToken.decimals)} {quote.buyToken.symbol}
                </Text>
              </View>
              {approvalRequired && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Token approval</Text>
                  <View style={[styles.badge, { backgroundColor: withAlpha(colors.warning, 0.14), borderColor: withAlpha(colors.warning, 0.35) }]}>
                    <Text style={[styles.badgeText, { color: colors.warning }]}>Required</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Loading state */}
          {(isQuoteLoading || balancesLoading) && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {balancesLoading ? "Loading balances…" : "Getting best quote…"}
              </Text>
            </View>
          )}

          {/* Error */}
          {errorMessage && (
            <View style={[styles.errorBanner, { backgroundColor: withAlpha(colors.danger, 0.1), borderColor: withAlpha(colors.danger, 0.25) }]}>
              <Feather name="alert-circle" size={14} color={colors.danger} style={{ marginTop: 1 }} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            </View>
          )}
        </View>

        {/* CTA buttons */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: canReview ? 1 : 0.38 }]}
          onPress={handleReviewSwap}
          disabled={!canReview || isValidating}
        >
          {isValidating ? (
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: colors.textOnAccent }]}>Review Swap</Text>
          )}
        </TouchableOpacity>

        {canExecute && (
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: withAlpha(colors.surfaceCard, 0.8),
                borderColor: withAlpha(colors.border, 0.3),
              },
            ]}
            onPress={handleExecuteSwap}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Confirm & Execute</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <AssetPickerModal
        isVisible={isAssetPickerVisible}
        onClose={() => setIsAssetPickerVisible(false)}
        onSelect={(asset) => {
          handleTokenSelect(asset);
          setIsAssetPickerVisible(false);
        }}
        assets={assetPickerList}
        title={assetPickerSide === "sell" ? "Select Sell Token" : "Select Buy Token"}
      />
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Header
  header: {
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  walletAddressText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    borderRadius: 14,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Chain chips
  chainRow: {
    gap: 8,
    marginBottom: 14,
    paddingRight: 8,
  },
  chainChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chainChipText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  // Main swap card
  mainCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 12,
  },
  swapSide: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  swapSideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  swapSideLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  balanceHint: {
    fontSize: 12,
    fontWeight: "500",
  },
  swapSideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tokenButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 7,
  },
  tokenButtonSymbol: {
    fontSize: 15,
    fontWeight: "800",
  },
  amountInput: {
    flex: 1,
    textAlign: "right",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
    padding: 0,
  },
  receiveAmountBox: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 36,
  },
  receiveAmount: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "right",
  },

  // Swap direction divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  swapDirectionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    position: "absolute",
    left: "50%",
    marginLeft: -19,
    zIndex: 10,
  },

  // Details card
  detailsCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
  },
  slippageSection: {
    gap: 10,
  },
  slippageTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slippageCurrentPct: {
    fontSize: 13,
    fontWeight: "800",
  },
  slippagePresets: {
    flexDirection: "row",
    gap: 8,
  },
  slippagePresetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slippagePresetText: {
    fontSize: 12,
    fontWeight: "700",
  },
  customSlippageRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  customSlippageInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    padding: 0,
  },
  customSlippageSuffix: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionDivider: {
    height: 1,
    marginVertical: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flex: 1,
    flexShrink: 1,
  },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },

  // Buttons
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export default DexScreen;
