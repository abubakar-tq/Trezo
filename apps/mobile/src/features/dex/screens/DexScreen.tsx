import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
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
import { classify, type ClassifiedError } from "@/src/features/swaps/services/SwapErrorClassifier";
import { SwapExecutionService } from "@/src/features/swaps/services/SwapExecutionService";
import { SwapPreparationService } from "@/src/features/swaps/services/SwapPreparationService";
import { SwapQuoteService } from "@/src/features/swaps/services/SwapQuoteService";
import type { SwapIntent, SwapPlan, SwapQuote } from "@/src/features/swaps/types/swap";
import WalletPersistenceService from "@/src/features/wallet/services/SupabaseWalletService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { getEnabledChains, type SupportedChainId } from "@/src/integration/chains";
import { resolveNetworkKey, getNetworkConfig } from "@/src/integration/networks";
import { useUserStore } from "@/src/store/useUserStore";
import { TabScreenContainer, TokenIcon, AssetPickerModal, type Asset } from "@shared/components";
import Toast from "@/src/shared/components/feedback/Toast";
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
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const contentBottomInset = useTabContentBottomInset();

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
  const [errorState, setErrorState] = useState<ClassifiedError | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: "info" | "warning" | "error" } | null>(null);
  const [retryNonce, setRetryNonce] = useState<number>(0);

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
    () => SwapQuoteService.getProvidersForNetwork(networkKey).length,
    [networkKey],
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
      const c = classify(error);
      if (c.kind === "network") {
        setToast({ message: c.userMessage, severity: c.severity });
      } else {
        setErrorState(c);
      }
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
          const c = classify(error);
          if (c.kind === "network") {
            setToast({ message: c.userMessage, severity: c.severity });
          } else {
            setErrorState(c);
          }
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
      setErrorState(classify(new Error("Sell and buy tokens must be different.")));
      return () => {
        cancelled = true;
      };
    }

    const debounce = setTimeout(async () => {
      if (cancelled) return;
      setErrorState(null);
      setUiState("quoting");

      try {
        const slippageBps = parseSlippageBps(slippagePct);
        const sellAmountRaw = parseUnits(sellAmountDecimal, sellToken.decimals);
        if (sellAmountRaw <= 0n) {
          throw new Error("Sell amount must be greater than zero.");
        }

        const nextQuote = await SwapQuoteService.getQuote({
          networkKey,
          chainId: selectedChainId,
          account: walletAddress,
          sellToken,
          buyToken,
          sellAmountRaw,
          slippageBps,
        });

        const allowance = await AllowanceService.isApprovalRequired({
          networkKey,
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
        const c = classify(error);
        if (c.kind === "network") {
          setToast({ message: c.userMessage, severity: c.severity });
        } else {
          setErrorState(c);
        }
      }
    }, DEFAULT_QUOTE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [buyToken, networkKey, selectedChainId, sellAmountDecimal, sellToken, slippagePct, walletAddress, retryNonce]);

  const buildIntent = (): SwapIntent | null => {
    if (!user?.id || !walletId || !walletAddress || !sellToken || !buyToken) {
      return null;
    }

    return {
      userId: user.id,
      aaWalletId: walletId,
      walletAddress,
      networkKey,
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
      setErrorState(classify(new Error("Missing user or wallet context for swap.")));
      return;
    }

    setErrorState(null);
    setUiState("validating");

    try {
      const plan = await SwapPreparationService.prepareSwap(intent);
      setPreparedPlan(plan);
      setUiState(plan.approvalRequired ? "approval_required" : "quote_ready");
    } catch (error) {
      setPreparedPlan(null);
      setUiState("failed");
      const c = classify(error);
      if (c.kind === "network") {
        setToast({ message: c.userMessage, severity: c.severity });
      } else {
        setErrorState(c);
      }
    }
  };

  const handleExecuteSwap = async () => {
    const intent = buildIntent();
    if (!intent) {
      setErrorState(classify(new Error("Missing user or wallet context for swap.")));
      return;
    }

    setErrorState(null);
    setUiState(preparedPlan?.approvalRequired ? "signing_approval" : "signing_swap");

    try {
      const result = await SwapExecutionService.executeSwap(intent, {
        waitForReceipt: true,
        receiptTimeoutMs: 60_000,
        receiptPollIntervalMs: 2_000,
      });

      if (result.status === "cancelled") {
        setErrorState(classify(new Error("User cancelled passkey prompt")));
      } else if (result.status === "failed" && result.error) {
        setErrorState(classify(new Error(result.error)));
      } else {
        setErrorState(null);
        const transactionId = result.swapTransactionId ?? result.approvalTransactionId ?? "";
        if (transactionId) {
          navigation.navigate("TransactionStatus", { transactionId });
        }
        if (result.status === "confirmed") {
          setUiState("confirmed");
        } else if (result.status === "pending") {
          setUiState(result.swapTransactionId ? "swap_pending" : "approval_pending");
        }
      }
    } catch (error) {
      setUiState("failed");
      const c = classify(error);
      if (c.kind === "network") {
        setToast({ message: c.userMessage, severity: c.severity });
      } else {
        setErrorState(c);
      }
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

  const envColor = (() => {
    const env = networkConfig?.environment ?? "local";
    if (env === "mainnet") return colors.accent;
    if (env === "local_fork") return "#F59E0B";
    if (env === "testnet") return "#A78BFA";
    return colors.success;
  })();

  return (
    <TabScreenContainer includeBottomInset>
      <Toast
        visible={Boolean(toast)}
        message={toast?.message ?? ""}
        severity={toast?.severity}
        onHide={() => setToast(null)}
      />

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
          <View>
            <Text style={styles.headerKicker}>DECENTRALIZED EXCHANGE</Text>
            <Text style={styles.headerTitle}>Exchange</Text>
          </View>
          <View style={styles.headerMeta}>
            <View style={[styles.networkBadge, { backgroundColor: `${envColor}1A`, borderColor: `${envColor}47` }]}>
              <View style={[styles.networkDot, { backgroundColor: envColor }]} />
              <Text style={[styles.networkBadgeText, { color: envColor }]}>
                {networkConfig?.displayName ?? `Chain ${selectedChainId}`}
              </Text>
            </View>
            {walletAddress && (
              <Text style={[styles.walletAddressText, { color: colors.textMuted }]}>
                {shorten(walletAddress)}
              </Text>
            )}
          </View>
        </View>

        {/* Swap / Bridge tab selector */}
        <View style={[styles.tabBar, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setActiveTab("swap")}
            style={[styles.tabBtn, activeTab === "swap" && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "swap" ? colors.textOnAccent : colors.textSecondary }]}>
              Swap
            </Text>
          </TouchableOpacity>
          <TouchableOpacity disabled style={[styles.tabBtn, { opacity: 0.35 }]}>
            <Text style={[styles.tabBtnText, { color: colors.textSecondary }]}>Bridge (soon)</Text>
          </TouchableOpacity>
        </View>

        {/* Chain chips */}
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
                    backgroundColor: isActive ? `${colors.accent}22` : colors.glass,
                    borderColor: isActive ? `${colors.accent}80` : colors.border,
                  },
                ]}
                onPress={() => {
                  setSelectedChainId(chain.id as SupportedChainId);
                  setPreparedPlan(null);
                  setErrorState(null);
                }}
              >
                <Text style={[styles.chainChipText, { color: isActive ? colors.accent : colors.textSecondary }]}>
                  {chain.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Main swap card */}
        <View style={[styles.swapCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          {/* Sell side */}
          <View style={styles.swapSide}>
            <View style={styles.swapSideTopRow}>
              <Text style={[styles.swapSideLabel, { color: colors.textSecondary }]}>You pay</Text>
              <Text style={[styles.balanceHint, { color: colors.textMuted }]}>
                {"Bal: "}
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                  {sellTokenBalanceDisplay} {sellToken?.symbol ?? ""}
                </Text>
              </Text>
            </View>
            <View style={styles.swapSideRow}>
              <TouchableOpacity
                style={[styles.tokenBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
                onPress={() => { setAssetPickerSide("sell"); setIsAssetPickerVisible(true); }}
              >
                <TokenIcon symbol={sellToken?.symbol ?? "?"} size={26} />
                <Text style={[styles.tokenBtnSymbol, { color: colors.textPrimary }]}>
                  {sellToken?.symbol ?? "Select"}
                </Text>
                <Feather name="chevron-down" size={13} color={colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.amountInput, { color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={sellAmountDecimal}
                onChangeText={setSellAmountDecimal}
              />
            </View>
          </View>

          {/* Swap direction button */}
          <View style={styles.swapDivider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderMuted }]} />
            <TouchableOpacity
              style={[styles.swapDirBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              onPress={handleSwapDirection}
            >
              <Ionicons name="swap-vertical" size={16} color={colors.accent} />
            </TouchableOpacity>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderMuted }]} />
          </View>

          {/* Buy side */}
          <View style={styles.swapSide}>
            <View style={styles.swapSideTopRow}>
              <Text style={[styles.swapSideLabel, { color: colors.textSecondary }]}>You receive</Text>
              <Text style={[styles.balanceHint, { color: colors.textMuted }]}>
                {providerCount > 0
                  ? `${providerCount} provider${providerCount !== 1 ? "s" : ""}`
                  : "No providers configured"}
              </Text>
            </View>
            <View style={styles.swapSideRow}>
              <TouchableOpacity
                style={[styles.tokenBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
                onPress={() => { setAssetPickerSide("buy"); setIsAssetPickerVisible(true); }}
              >
                <TokenIcon symbol={buyToken?.symbol ?? "?"} size={26} />
                <Text style={[styles.tokenBtnSymbol, { color: colors.textPrimary }]}>
                  {buyToken?.symbol ?? "Select"}
                </Text>
                <Feather name="chevron-down" size={13} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.receiveBox}>
                {isQuoteLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={[styles.receiveAmount, { color: quote ? colors.textPrimary : colors.textMuted }]}>
                    {quote ? formatUnits(quote.estimatedBuyAmountRaw, quote.buyToken.decimals) : "0.00"}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Details / slippage card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.glass, borderColor: colors.border }]}>
          {/* Slippage row */}
          <View style={styles.slippageBlock}>
            <View style={styles.slippageTitleRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Max Slippage</Text>
              <Text style={[styles.slippageValue, { color: colors.textPrimary }]}>{slippagePct}%</Text>
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
                        backgroundColor: isSelected ? `${colors.accent}22` : colors.glass,
                        borderColor: isSelected ? colors.accent : colors.border,
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
                    backgroundColor: customSlippageActive ? `${colors.accent}22` : colors.glass,
                    borderColor: customSlippageActive ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text style={[styles.slippagePresetText, { color: customSlippageActive ? colors.accent : colors.textSecondary }]}>
                  Custom
                </Text>
              </TouchableOpacity>
            </View>
            {customSlippageActive && (
              <View style={[styles.customSlippageRow, { backgroundColor: colors.glass, borderColor: colors.border }]}>
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

          {/* Quote details */}
          {quote && (
            <>
              <View style={[styles.sectionDivider, { backgroundColor: colors.borderMuted }]} />
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
                  <View style={[styles.statusPill, { backgroundColor: colors.warningSoft, borderColor: `${colors.warning}59` }]}>
                    <Text style={[styles.statusPillText, { color: colors.warning }]}>Required</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Loading */}
          {(isQuoteLoading || balancesLoading) && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {balancesLoading ? "Loading balances…" : "Getting best quote…"}
              </Text>
            </View>
          )}

          {/* Error */}
          {errorState ? (
            errorState.kind === "user_rejected" ? (
              <View style={[styles.infoPill, { backgroundColor: `${colors.accent}1F`, borderColor: `${colors.accent}66` }]}>
                <Text style={[styles.infoPillText, { color: colors.accent }]}>{errorState.userMessage}</Text>
              </View>
            ) : (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: errorState.severity === "warning" ? colors.warningSoft : colors.dangerSoft,
                    borderColor: errorState.severity === "warning" ? `${colors.warning}66` : `${colors.danger}66`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.errorBannerText,
                    { color: errorState.severity === "warning" ? colors.warning : colors.danger },
                  ]}
                >
                  {errorState.userMessage}
                </Text>
                {errorState.retryable ? (
                  <TouchableOpacity
                    onPress={() => {
                      setErrorState(null);
                      setRetryNonce((n) => n + 1);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.retryText, { color: colors.accent }]}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          ) : null}
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
            style={[styles.secondaryBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
    },

    // Header
    header: {
      gap: 8,
      marginBottom: 18,
    },
    headerKicker: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 2,
      color: colors.accent,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -1,
      color: colors.textPrimary,
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
      borderRadius: 9,
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

    // Tab bar
    tabBar: {
      flexDirection: "row",
      padding: 4,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 12,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    tabBtnText: {
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
      borderRadius: 9,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    chainChipText: {
      fontSize: 12,
      fontWeight: "700",
    },

    // Swap card
    swapCard: {
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
    swapSideTopRow: {
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
    tokenBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      gap: 6,
    },
    tokenBtnSymbol: {
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
    receiveBox: {
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
    swapDivider: {
      flexDirection: "row",
      alignItems: "center",
      height: 28,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    swapDirBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      position: "absolute",
      left: "50%",
      marginLeft: -18,
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
    slippageBlock: {
      gap: 10,
    },
    slippageTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    slippageValue: {
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
      borderRadius: 9,
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
      height: StyleSheet.hairlineWidth,
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
    statusPill: {
      borderRadius: 7,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusPillText: {
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
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    errorBannerText: {
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
    },
    retryText: {
      fontSize: 13,
      fontWeight: "700",
    },
    infoPill: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    infoPillText: {
      fontSize: 12,
      fontWeight: "600",
    },

    // Buttons
    primaryBtn: {
      height: 56,
      borderRadius: 17,
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
      borderRadius: 17,
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
