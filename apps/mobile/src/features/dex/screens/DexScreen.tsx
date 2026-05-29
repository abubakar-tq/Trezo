import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
import { BridgeQuoteService } from "@/src/features/swaps/services/BridgeQuoteService";
import { BridgeExecutionService } from "@/src/features/swaps/services/BridgeExecutionService";
import { BridgePreparationService } from "@/src/features/swaps/services/BridgePreparationService";
import type { SwapIntent, SwapPlan, SwapQuote } from "@/src/features/swaps/types/swap";
import type { BridgeIntent, BridgePlan, BridgeQuote } from "@/src/features/swaps/types/bridge";
import WalletPersistenceService from "@/src/features/wallet/services/SupabaseWalletService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { resolveNetworkKey, getNetworkConfig } from "@/src/integration/networks";
import {
  getBridgeConfig,
  isCrossChainBridgeReady,
  isCrossChainSwapReady,
  getCrossChainDestinations,
} from "@/src/features/swaps/config/bridgeRegistry";
import { useUserStore } from "@/src/store/useUserStore";
import { defaultSlippageBps } from "@/src/features/dex/utils/slippage";
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
  chainId: token.chainId,
});

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

  const [activeTab, setActiveTab] = useState<DexTab>("swap");

  const [sellToken, setSellToken] = useState<TokenMetadata | null>(null);
  const [buyToken, setBuyToken] = useState<TokenMetadata | null>(null);

  const selectedChainId = useMemo<SupportedChainId>(
    () => sellToken?.chainId ?? buyToken?.chainId ?? DEFAULT_CHAIN_ID,
    [sellToken?.chainId, buyToken?.chainId],
  );
  const [sellAmountDecimal, setSellAmountDecimal] = useState<string>("");
  const [slippageBpsOverride, setSlippageBpsOverride] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

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
  const [assetPickerSide, setAssetPickerSide] = useState<"sell" | "buy" | "bridgeOutput">("sell");

  // ── Bridge tab state ───────────────────────────────────────────────────────
  const [bridgeDestNetworkKey, setBridgeDestNetworkKey] = useState<string | null>(null);
  // null = use canonical same-symbol token; set = user has explicitly picked a different output.
  const [bridgeDestOutputToken, setBridgeDestOutputToken] = useState<TokenMetadata | null>(null);
  const [bridgeQuote, setBridgeQuote] = useState<BridgeQuote | null>(null);
  const [bridgePlan, setBridgePlan] = useState<BridgePlan | null>(null);
  const [bridgeBusy, setBridgeBusy] = useState<boolean>(false);

  const networkKey = useMemo(() => resolveNetworkKey(selectedChainId), [selectedChainId]);

  const networkConfig = useMemo(() => {
    try { return getNetworkConfig(networkKey); } catch { return null; }
  }, [networkKey]);

  const swapSupported = networkConfig?.swapSupported ?? false;

  const bridgeReady = useMemo(() => isCrossChainBridgeReady(networkKey), [networkKey]);
  const bridgeConfig = useMemo(() => getBridgeConfig(networkKey), [networkKey]);
  const bridgeDestinations = useMemo(() => getCrossChainDestinations(networkKey), [networkKey]);

  // Cross-chain swap (different output token on destination) requires a
  // CrossChainExecutor on the destination. Same-asset bridge does not.
  const crossChainSwapReadyOnDest = useMemo(
    () => (bridgeDestNetworkKey ? isCrossChainSwapReady(bridgeDestNetworkKey as never) : false),
    [bridgeDestNetworkKey],
  );

  // Destination-chain token list — used for the bridge-tab output picker.
  const bridgeDestTokens = useMemo(
    () =>
      bridgeDestNetworkKey
        ? TokenRegistryService.listSwapTokensForNetwork(bridgeDestNetworkKey as never)
        : [],
    [bridgeDestNetworkKey],
  );

  // The "canonical" same-symbol destination token for the currently selected
  // source sellToken. Used as the default output when the user hasn't picked
  // explicitly, and rendered as the fallback when cross-chain swap isn't ready.
  const canonicalBridgeOutputToken = useMemo(() => {
    if (!sellToken || !bridgeDestTokens.length) return null;
    return bridgeDestTokens.find(
      (t) => t.symbol.toLowerCase() === sellToken.symbol.toLowerCase(),
    ) ?? null;
  }, [sellToken, bridgeDestTokens]);

  // Effective bridge output token: user pick when present + valid on dest, else canonical.
  const effectiveBridgeOutputToken = useMemo<TokenMetadata | null>(() => {
    if (!bridgeDestOutputToken) return canonicalBridgeOutputToken;
    // Validate that the picked token is still on the active destination chain.
    const stillValid = bridgeDestTokens.some(
      (t) => t.address.toLowerCase() === bridgeDestOutputToken.address.toLowerCase()
        && t.chainId === bridgeDestOutputToken.chainId,
    );
    return stillValid ? bridgeDestOutputToken : canonicalBridgeOutputToken;
  }, [bridgeDestOutputToken, canonicalBridgeOutputToken, bridgeDestTokens]);

  // Reset the user's explicit pick when the source token or destination changes —
  // a USDC→WETH route on Base Sepolia doesn't make sense if the user just switched
  // source to a token with no WETH pool on the new destination.
  useEffect(() => {
    setBridgeDestOutputToken(null);
  }, [sellToken?.symbol, sellToken?.chainId, bridgeDestNetworkKey]);

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

  const defaultBps = useMemo(
    () => defaultSlippageBps(sellToken?.symbol, buyToken?.symbol),
    [sellToken?.symbol, buyToken?.symbol],
  );

  const effectiveSlippageBps = slippageBpsOverride ?? defaultBps;

  const assetPickerList = useMemo(() => {
    // The bridge-output picker draws from the destination chain's token list
    // (balances on destination aren't loaded in this screen, so render as 0).
    if (assetPickerSide === "bridgeOutput") {
      return bridgeDestTokens
        .filter((token) => token.type === "erc20")
        .map((token) => toAsset(token, 0n));
    }
    return swapTokens.map((token) => toAsset(token, tokenBalances[toTokenKey(token) ?? "native"] ?? 0n));
  }, [assetPickerSide, swapTokens, tokenBalances, bridgeDestTokens]);

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

    if (!swapSupported) {
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
        const slippageBps = effectiveSlippageBps;
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
  }, [buyToken, networkKey, selectedChainId, sellAmountDecimal, sellToken, effectiveSlippageBps, walletAddress, retryNonce, swapSupported]);

  // ── Bridge: auto-pick first available destination when source changes ──────
  useEffect(() => {
    if (activeTab !== "bridge") return;
    if (!bridgeDestNetworkKey || !bridgeDestinations.includes(bridgeDestNetworkKey as never)) {
      setBridgeDestNetworkKey(bridgeDestinations[0] ?? null);
    }
  }, [activeTab, bridgeDestNetworkKey, bridgeDestinations]);

  // ── Bridge: fetch quote when bridge inputs are ready ───────────────────────
  useEffect(() => {
    let cancelled = false;
    setBridgePlan(null);

    if (activeTab !== "bridge") {
      setBridgeQuote(null);
      return () => { cancelled = true; };
    }

    if (!bridgeReady || !walletAddress || !sellToken || !bridgeDestNetworkKey) {
      setBridgeQuote(null);
      return () => { cancelled = true; };
    }

    if (sellToken.type !== "erc20") {
      setBridgeQuote(null);
      return () => { cancelled = true; };
    }

    if (!sellAmountDecimal.trim()) {
      setBridgeQuote(null);
      return () => { cancelled = true; };
    }

    const debounce = setTimeout(async () => {
      if (cancelled) return;
      setErrorState(null);

      try {
        const destNetworkConfig = getNetworkConfig(bridgeDestNetworkKey as never);
        const destOutputToken = effectiveBridgeOutputToken;
        if (!destOutputToken) {
          throw new Error(`No matching ${sellToken.symbol} on destination network.`);
        }

        const inputAmountRaw = parseUnits(sellAmountDecimal, sellToken.decimals);
        if (inputAmountRaw <= 0n) {
          throw new Error("Bridge amount must be greater than zero.");
        }

        const q = await BridgeQuoteService.getQuote({
          sourceNetworkKey: networkKey,
          sourceChainId: selectedChainId,
          destNetworkKey: bridgeDestNetworkKey as never,
          destChainId: destNetworkConfig.chainId,
          account: walletAddress,
          inputToken: sellToken,
          outputToken: destOutputToken,
          inputAmountRaw,
          destSwapSlippageBps: effectiveSlippageBps,
        });

        if (cancelled) return;
        setBridgeQuote(q);
      } catch (error) {
        if (cancelled) return;
        setBridgeQuote(null);
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
  }, [
    activeTab, bridgeReady, walletAddress, sellToken, sellAmountDecimal,
    bridgeDestNetworkKey, networkKey, selectedChainId, retryNonce,
    effectiveBridgeOutputToken, effectiveSlippageBps,
  ]);

  const buildBridgeIntent = (): BridgeIntent | null => {
    if (!user?.id || !walletId || !walletAddress || !sellToken || !bridgeDestNetworkKey) {
      return null;
    }
    if (sellToken.type !== "erc20") return null;

    const destNetworkConfig = (() => {
      try { return getNetworkConfig(bridgeDestNetworkKey as never); } catch { return null; }
    })();
    if (!destNetworkConfig) return null;

    const destOutputToken = effectiveBridgeOutputToken;
    if (!destOutputToken) return null;

    return {
      userId: user.id,
      aaWalletId: walletId,
      walletAddress,
      sourceNetworkKey: networkKey,
      sourceChainId: selectedChainId,
      destNetworkKey: bridgeDestNetworkKey as never,
      destChainId: destNetworkConfig.chainId,
      inputToken: sellToken,
      inputAmountDecimal: sellAmountDecimal.trim(),
      outputToken: destOutputToken,
      slippageBps: effectiveSlippageBps,
    };
  };

  const handleReviewBridge = async () => {
    const intent = buildBridgeIntent();
    if (!intent) {
      setErrorState(classify(new Error("Missing user, wallet, or token context for bridge.")));
      return;
    }
    setErrorState(null);
    setBridgeBusy(true);
    try {
      const plan = await BridgePreparationService.prepareBridge(intent);
      setBridgePlan(plan);
    } catch (error) {
      setBridgePlan(null);
      const c = classify(error);
      if (c.kind === "network") {
        setToast({ message: c.userMessage, severity: c.severity });
      } else {
        setErrorState(c);
      }
    } finally {
      setBridgeBusy(false);
    }
  };

  const handleExecuteBridge = async () => {
    const intent = buildBridgeIntent();
    if (!intent) {
      setErrorState(classify(new Error("Missing user, wallet, or token context for bridge.")));
      return;
    }
    setErrorState(null);
    setBridgeBusy(true);
    try {
      const result = await BridgeExecutionService.executeBridge(intent, {
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
        const transactionId = result.bridgeTransactionId ?? result.approvalTransactionId ?? "";
        if (transactionId) {
          navigation.navigate("TransactionStatus", { transactionId });
        }
      }
    } catch (error) {
      const c = classify(error);
      if (c.kind === "network") {
        setToast({ message: c.userMessage, severity: c.severity });
      } else {
        setErrorState(c);
      }
    } finally {
      setBridgeBusy(false);
    }
  };

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
      slippageBps: effectiveSlippageBps,
    };
  };

  const handleTokenSelect = (asset: Asset) => {
    if (assetPickerSide === "bridgeOutput") {
      const next = bridgeDestTokens.find(
        (token) =>
          token.symbol === asset.symbol
          && (asset.chainId === undefined || token.chainId === asset.chainId),
      );
      if (!next) return;
      setBridgeDestOutputToken(next);
      setBridgePlan(null);
      return;
    }

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
      && swapSupported
      && sellAmountDecimal.trim().length > 0
      && quoteReady,
  );
  const canExecute = Boolean(preparedPlan);

  // ── Quote freshness countdown ─────────────────────────────────────────────
  const [nowMs, setNowMs] = useState<number>(Date.now());
  useEffect(() => {
    if (!quote?.expiresAt) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quote?.expiresAt]);

  const quoteSecondsRemaining = useMemo(() => {
    if (!quote?.expiresAt) return null;
    const expiresAtMs = new Date(quote.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) return null;
    return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
  }, [quote?.expiresAt, nowMs]);

  const quoteIsExpired = quoteSecondsRemaining !== null && quoteSecondsRemaining === 0;

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
          <TouchableOpacity
            onPress={() => setActiveTab("bridge")}
            style={[styles.tabBtn, activeTab === "bridge" && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === "bridge" ? colors.textOnAccent : colors.textSecondary }]}>
              Bridge
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "bridge" && (
          <>
            {!bridgeReady && (
              <View style={[styles.detailsCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <Text style={[styles.detailLabel, { color: colors.textPrimary, fontSize: 15 }]}>
                  Cross-chain bridge (Across V3)
                </Text>
                <View style={[styles.infoPill, { backgroundColor: `${colors.warning}1F`, borderColor: `${colors.warning}66` }]}>
                  <Text style={[styles.infoPillText, { color: colors.warning }]}>
                    No Across SpokePool configured for {networkConfig?.displayName ?? networkKey}. Switch to a network with bridge support.
                  </Text>
                </View>
              </View>
            )}

            {bridgeReady && (
              <>
                {/* Bridge: source side */}
                <View style={[styles.swapCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                  <View style={styles.swapSide}>
                    <View style={styles.swapSideTopRow}>
                      <Text style={[styles.swapSideLabel, { color: colors.textSecondary }]}>You send</Text>
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

                  {/* Destination chain selector row */}
                  <View style={[styles.swapDivider]}>
                    <View style={[styles.dividerLine, { backgroundColor: colors.borderMuted }]} />
                    <View style={[styles.swapDirBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                      <Ionicons name="arrow-down" size={14} color={colors.accent} />
                    </View>
                    <View style={[styles.dividerLine, { backgroundColor: colors.borderMuted }]} />
                  </View>

                  <View style={styles.swapSide}>
                    <View style={styles.swapSideTopRow}>
                      <Text style={[styles.swapSideLabel, { color: colors.textSecondary }]}>To chain</Text>
                    </View>
                    <View style={styles.destChainRow}>
                      {bridgeDestinations.map((dest) => {
                        const isSelected = dest === bridgeDestNetworkKey;
                        const destName = (() => {
                          try { return getNetworkConfig(dest).displayName; } catch { return dest; }
                        })();
                        return (
                          <TouchableOpacity
                            key={dest}
                            onPress={() => setBridgeDestNetworkKey(dest)}
                            style={[
                              styles.destChainChip,
                              {
                                backgroundColor: isSelected ? colors.accent : colors.glass,
                                borderColor: isSelected ? colors.accent : colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.destChainChipText,
                                { color: isSelected ? colors.textOnAccent : colors.textPrimary },
                              ]}
                            >
                              {destName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Destination output token picker — only meaningful when cross-chain swap is wired on dest */}
                  {bridgeDestNetworkKey && (
                    <View style={styles.swapSide}>
                      <View style={styles.swapSideTopRow}>
                        <Text style={[styles.swapSideLabel, { color: colors.textSecondary }]}>You receive</Text>
                        {!crossChainSwapReadyOnDest && (
                          <Text style={[styles.swapSideLabel, { color: colors.textMuted, fontSize: 11 }]}>
                            same-asset only on this dest
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        disabled={!crossChainSwapReadyOnDest}
                        onPress={() => {
                          setAssetPickerSide("bridgeOutput");
                          setIsAssetPickerVisible(true);
                        }}
                        style={[
                          styles.tokenBtn,
                          {
                            backgroundColor: colors.glass,
                            borderColor: colors.border,
                            opacity: crossChainSwapReadyOnDest ? 1 : 0.6,
                          },
                        ]}
                      >
                        {effectiveBridgeOutputToken ? (
                          <>
                            <TokenIcon symbol={effectiveBridgeOutputToken.symbol} size={20} />
                            <Text style={[styles.tokenBtnSymbol, { color: colors.textPrimary }]}>
                              {effectiveBridgeOutputToken.symbol}
                            </Text>
                          </>
                        ) : (
                          <Text style={[styles.tokenBtnSymbol, { color: colors.textMuted }]}>
                            No matching token on destination
                          </Text>
                        )}
                        {crossChainSwapReadyOnDest && (
                          <Feather name="chevron-down" size={13} color={colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Bridge details card */}
                <View style={[styles.detailsCard, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                  {bridgeQuote ? (
                    <>
                      {bridgeQuote.destSwap ? (
                        <>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>You receive (est.)</Text>
                            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                              ~{formatUnits(bridgeQuote.destSwap.expectedOutRaw, bridgeQuote.outputToken.decimals)}{" "}
                              {bridgeQuote.outputToken.symbol}
                            </Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Minimum out</Text>
                            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                              {formatUnits(bridgeQuote.destSwap.minOutRaw, bridgeQuote.outputToken.decimals)}{" "}
                              {bridgeQuote.outputToken.symbol} ({bridgeQuote.destSwap.slippageBps} bps slip)
                            </Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Bridged via</Text>
                            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                              {formatUnits(bridgeQuote.outputAmountRaw, bridgeQuote.destSwap.canonicalToken.decimals)}{" "}
                              {bridgeQuote.destSwap.canonicalToken.symbol} (canonical)
                            </Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Dest pool fee</Text>
                            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                              {(bridgeQuote.destSwap.feeTier / 10_000).toFixed(2)}%
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.detailRow}>
                          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>You receive</Text>
                          <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                            {formatUnits(bridgeQuote.outputAmountRaw, bridgeQuote.outputToken.decimals)}{" "}
                            {bridgeQuote.outputToken.symbol}
                          </Text>
                        </View>
                      )}
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Relayer fee</Text>
                        <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                          {(bridgeQuote.feeBps / 100).toFixed(2)}%
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Fill deadline</Text>
                        <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                          {Math.round((bridgeQuote.fillDeadline * 1000 - Date.now()) / 60_000)}m
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Delivered to</Text>
                        <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                          {bridgeQuote.destSwapRequired
                            ? `${shorten(bridgeQuote.destExecutor ?? "")} (executor)`
                            : `${shorten(bridgeQuote.destRecipient)} (your wallet)`}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
                      {sellAmountDecimal.trim() ? "Calculating bridge quote…" : "Enter an amount to see the bridge quote."}
                    </Text>
                  )}

                  {/* Error */}
                  {errorState ? (
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
                    </View>
                  ) : null}
                </View>

                {/* Bridge CTA buttons */}
                {!bridgePlan && (
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: colors.accent, opacity: bridgeQuote && !bridgeBusy ? 1 : 0.38 },
                    ]}
                    onPress={handleReviewBridge}
                    disabled={!bridgeQuote || bridgeBusy}
                  >
                    {bridgeBusy ? (
                      <ActivityIndicator size="small" color={colors.textOnAccent} />
                    ) : (
                      <Text style={[styles.primaryBtnText, { color: colors.textOnAccent }]}>Review Bridge</Text>
                    )}
                  </TouchableOpacity>
                )}

                {bridgePlan && (
                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      { backgroundColor: colors.glass, borderColor: colors.border, opacity: bridgeBusy ? 0.38 : 1 },
                    ]}
                    onPress={handleExecuteBridge}
                    disabled={bridgeBusy}
                  >
                    {bridgeBusy ? (
                      <ActivityIndicator size="small" color={colors.textPrimary} />
                    ) : (
                      <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                        Confirm & Bridge
                        {bridgePlan.approvalRequired ? " (approve + deposit)" : ""}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "swap" && (
        <>
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
            {buyToken?.type === "erc20" && (
              <View style={styles.contractRow}>
                <Text style={[styles.contractAddress, { color: colors.textSecondary }]}>
                  {shorten(buyToken.address)}
                </Text>
                <Pressable
                  onPress={() => Clipboard.setStringAsync(buyToken.address)}
                  hitSlop={10}
                >
                  <Feather name="copy" size={12} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Details card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.glass, borderColor: colors.border }]}>
          {/* Swap not supported on this network */}
          {!swapSupported && (
            <View style={[styles.errorBanner, { backgroundColor: colors.warningSoft, borderColor: `${colors.warning}66` }]}>
              <Text style={[styles.errorBannerText, { color: colors.warning }]}>
                Swap is not available on {networkConfig?.displayName ?? networkKey}. Switch to a network where the Uniswap V3 pool has been healthchecked.
              </Text>
            </View>
          )}

          {/* Quote details */}
          {quote && sellToken && buyToken && (
            <>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Estimated receive</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {formatUnits(quote.estimatedBuyAmountRaw, quote.buyToken.decimals)} {quote.buyToken.symbol}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Minimum received</Text>
                <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
                  {formatUnits(quote.minimumBuyAmountRaw, quote.buyToken.decimals)} {quote.buyToken.symbol}
                </Text>
              </View>
              {quote.priceImpactBps !== undefined && quote.priceImpactBps > 100 && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.warning }]}>Price impact</Text>
                  <Text style={[styles.detailValue, { color: colors.warning }]}>
                    {(quote.priceImpactBps / 100).toFixed(2)}%
                  </Text>
                </View>
              )}
              {approvalRequired && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Token approval</Text>
                  <View style={[styles.statusPill, { backgroundColor: colors.warningSoft, borderColor: `${colors.warning}59` }]}>
                    <Text style={[styles.statusPillText, { color: colors.warning }]}>Required</Text>
                  </View>
                </View>
              )}
              {quoteSecondsRemaining !== null && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Quote freshness</Text>
                  <View style={styles.quoteFreshRow}>
                    <Text
                      style={[
                        styles.detailValue,
                        { color: quoteIsExpired ? colors.warning : colors.textSecondary, textAlign: "right" },
                      ]}
                    >
                      {quoteIsExpired ? "Expired" : `${quoteSecondsRemaining}s`}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setRetryNonce((n) => n + 1)}
                      hitSlop={8}
                      style={styles.refreshBtn}
                    >
                      <Feather name="refresh-ccw" size={12} color={colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={[styles.sectionDivider, { backgroundColor: colors.borderMuted }]} />
            </>
          )}

          {/* Advanced expander */}
          <TouchableOpacity
            onPress={() => setAdvancedOpen((v) => !v)}
            style={styles.advancedToggle}
          >
            <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>Advanced</Text>
            <Feather
              name={advancedOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          {advancedOpen && (
            <View style={styles.advancedBody}>
              <View style={styles.slippageTitleRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Slippage tolerance</Text>
                <Text style={[styles.slippageValue, { color: colors.textPrimary }]}>
                  {(effectiveSlippageBps / 100).toFixed(2)}%
                </Text>
              </View>
              <View style={[styles.customSlippageRow, { backgroundColor: colors.glass, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.customSlippageInput, { color: colors.textPrimary }]}
                  keyboardType="decimal-pad"
                  placeholder={`${defaultBps / 100}% (auto)`}
                  placeholderTextColor={colors.textMuted}
                  value={slippageBpsOverride !== null ? String(slippageBpsOverride / 100) : ""}
                  onChangeText={(t) => {
                    if (t === "") { setSlippageBpsOverride(null); return; }
                    const n = Number(t);
                    if (Number.isFinite(n) && n >= 0 && n <= 50) {
                      setSlippageBpsOverride(Math.round(n * 100));
                    }
                  }}
                />
                <Text style={[styles.customSlippageSuffix, { color: colors.textSecondary }]}>%</Text>
              </View>
            </View>
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
        </>
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
        title={
          assetPickerSide === "sell"
            ? "Select Sell Token"
            : assetPickerSide === "buy"
              ? "Select Buy Token"
              : "Select Destination Token"
        }
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

    // Contract address row (below buy token)
    contractRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    contractAddress: {
      fontFamily: "monospace",
      fontSize: 11,
      opacity: 0.6,
    },

    // Details card
    detailsCard: {
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      gap: 12,
      marginBottom: 16,
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
    advancedToggle: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    advancedBody: {
      gap: 10,
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
    quoteFreshRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    refreshBtn: {
      padding: 4,
    },
    destChainRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    destChainChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
    },
    destChainChipText: {
      fontSize: 13,
      fontWeight: "700",
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
