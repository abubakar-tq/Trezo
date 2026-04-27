import type { TokenBalance } from "@/src/features/portfolio/services/PortfolioService";
import { PortfolioService } from "@/src/features/portfolio/services/PortfolioService";
import {
    AccountDeploymentService,
    deriveDefaultWalletId,
} from "@/src/features/wallet/services/AccountDeploymentService";
import {
    DEV_FUNDING_AMOUNT_ETH,
    devFundSmartAccount,
} from "@/src/features/wallet/services/devFunding";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import WalletSyncService from "@/src/features/wallet/services/WalletSyncService";
import type { AAAccount } from "@/src/features/wallet/store/useWalletStore";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
    DEFAULT_CHAIN_ID,
    isPortableChain,
    type SupportedChainId,
} from "@/src/integration/chains";
import type {
    RootStackParamList,
    TabStackParamList,
} from "@/src/types/navigation";
import { Feather } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
    useNavigation,
    type CompositeNavigationProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TabScreenContainer } from "@shared/components";
import { MarketTokenSkeleton } from "@shared/components/ui";
import { LinearGradient } from "expo-linear-gradient";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Clipboard,
    Easing,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { type Address } from "viem";

import { useTabContentBottomInset } from "@app/hooks";
import {
    MARKET_CHAIN_OPTIONS,
    fetchTokenMarketDetail,
    type EvmChain,
    type MarketToken,
    type TokenMarketDetail,
} from "@lib/api/web3Data";
import { useMarketStore } from "@store/useMarketStore";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

type QuickAction = {
  key: "send" | "receive" | "buy" | "swap";
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  description: string;
};

const quickActions: QuickAction[] = [
  {
    key: "send",
    label: "Send",
    icon: "arrow-up-right",
    description: "Move assets from your wallet to another address.",
  },
  {
    key: "receive",
    label: "Receive",
    icon: "arrow-down-left",
    description: "Generate deposit details to receive funds securely.",
  },
  {
    key: "buy",
    label: "Buy",
    icon: "credit-card",
    description: "Purchase crypto with fiat using curated providers.",
  },
  {
    key: "swap",
    label: "Swap",
    icon: "repeat",
    description: "Exchange one token for another without leaving Trezo.",
  },
];

const EMPTY_TOKENS: MarketToken[] = [];
type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabStackParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { profile, user } = useUserStore();
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const contentBottomInset = useTabContentBottomInset();

  // Smart Account deployment status
  const smartAccountAddress = useUserStore(
    (state) => state.smartAccountAddress,
  );
  const smartAccountDeployed = useUserStore(
    (state) => state.smartAccountDeployed,
  );
  const setSmartAccountAddress = useUserStore(
    (state) => state.setSmartAccountAddress,
  );
  const setSmartAccountDeployed = useUserStore(
    (state) => state.setSmartAccountDeployed,
  );
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const markAsDeployed = useWalletStore((state) => state.markAsDeployed);
  const setAAAccount = useWalletStore((state) => state.setAAAccount);
  const isWalletDeployed = smartAccountDeployed;
  const userId = user?.id ?? null;
  const resolvedDeployChainId = (aaAccount?.chainId ??
    DEFAULT_CHAIN_ID) as SupportedChainId;

  // Portfolio data
  const [portfolioBalance, setPortfolioBalance] = useState(0);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolio, setPortfolio] = useState<Awaited<
    ReturnType<typeof PortfolioService.getPortfolio>
  > | null>(null);

  const activeChain = useMarketStore((state) => state.activeChain);
  const setActiveChain = useMarketStore((state) => state.setActiveChain);
  const fetchMarketData = useMarketStore((state) => state.fetchMarketData);
  const warmCache = useMarketStore((state) => state.warmCache);
  const loading = useMarketStore((state) => state.loading);
  const error = useMarketStore((state) => state.error);

  // Load portfolio balance
  useEffect(() => {
    const loadBalance = async () => {
      if (!aaAccount?.predictedAddress) {
        setPortfolio(null);
        setPortfolioBalance(0);
        return;
      }

      setPortfolioLoading(true);
      const portfolioData = await PortfolioService.getPortfolio(
        aaAccount.predictedAddress,
      );
      setPortfolio(portfolioData);
      setPortfolioBalance(portfolioData.totalValue);
      setPortfolioLoading(false);
    };

    loadBalance();
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, [aaAccount?.predictedAddress]);
  const clearError = useMarketStore((state) => state.clearError);
  const searchQuery = useMarketStore((state) => state.searchQuery);
  const setSearchQuery = useMarketStore((state) => state.setSearchQuery);
  const chainState = useMarketStore((state) => state.chains[activeChain]);

  // Get all tokens when "all" is selected
  const allChains = useMarketStore((state) => state.chains);
  const tokens = useMemo(() => {
    if (activeChain === "all") {
      // Combine tokens from all chains
      return Object.values(allChains).flatMap((chain) => chain.tokens);
    }
    return chainState?.tokens ?? EMPTY_TOKENS;
  }, [activeChain, allChains, chainState]);

  const source = chainState?.source ?? null;
  const lastUpdated = chainState?.lastUpdated ?? null;

  const [selectedToken, setSelectedToken] = useState<MarketToken | null>(null);
  const [tokenDetail, setTokenDetail] = useState<TokenMarketDetail | null>(
    null,
  );
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRequestId, setDetailRequestId] = useState(0);
  const detailAbortRef = useRef<AbortController | null>(null);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [deployingAccount, setDeployingAccount] = useState(false);
  const [fundingAccount, setFundingAccount] = useState(false);
  const [accountActionStatus, setAccountActionStatus] = useState<string | null>(
    null,
  );
  const [activeAction, setActiveAction] = useState<QuickAction | null>(null);
  const refreshRotation = useRef(new Animated.Value(0)).current;

  // Copy address to clipboard
  const handleCopyAddress = useCallback(() => {
    if (smartAccountAddress) {
      Clipboard.setString(smartAccountAddress);
      Alert.alert("Copied!", "Address copied to clipboard", [{ text: "OK" }]);
    }
  }, [smartAccountAddress]);

  const fundSmartAccount = useCallback(
    async (targetAddress?: string, options?: { silent?: boolean }) => {
      const destination = (targetAddress ?? smartAccountAddress) as
        | Address
        | undefined;
      if (!destination) {
        if (!options?.silent) {
          Alert.alert(
            "No Address",
            "Deploy your smart account before funding it.",
          );
        }
        return null;
      }
      try {
        setFundingAccount(true);
        setAccountActionStatus("Funding smart account…");
        const { transactionHash } = await devFundSmartAccount({
          address: destination,
          chainId: resolvedDeployChainId,
        });
        if (!options?.silent) {
          Alert.alert(
            "Account Funded",
            `Sent ${DEV_FUNDING_AMOUNT_ETH} ETH to:\n${destination}\n\nTx: ${transactionHash.slice(0, 12)}…`,
          );
        }
        return transactionHash;
      } catch (error) {
        if (!options?.silent) {
          Alert.alert(
            "Funding Failed",
            error instanceof Error ? error.message : "Unable to fund account",
          );
        }
        throw error;
      } finally {
        setFundingAccount(false);
        setAccountActionStatus(null);
      }
    },
    [smartAccountAddress, resolvedDeployChainId],
  );

  const handleDeploySmartAccount = useCallback(async () => {
    if (deployingAccount) return;
    if (!userId) {
      Alert.alert(
        "Sign In Required",
        "Please sign in before deploying your smart account.",
      );
      return;
    }
    try {
      setDeployingAccount(true);
      setAccountActionStatus("Preparing deployment…");

      let passkey = await PasskeyService.getPasskey(userId);
      if (!passkey) {
        const created = await PasskeyService.createPasskey(userId);
        passkey = created ?? (await PasskeyService.getPasskey(userId));
      }
      if (!passkey) {
        throw new Error("Unable to access passkey credentials on this device.");
      }

      const walletIndex = aaAccount?.walletIndex ?? 0;
      const walletId = (aaAccount?.walletId ?? deriveDefaultWalletId(userId)) as `0x${string}`;
      const deploymentMode =
        aaAccount?.deploymentMode ?? (isPortableChain(resolvedDeployChainId) ? "portable" : "chain-specific");
      const predictedAddress = await AccountDeploymentService.predictAddress(
        walletId,
        passkey,
        resolvedDeployChainId,
        walletIndex,
        deploymentMode,
      );
      setSmartAccountAddress(predictedAddress);
      const walletName = `${profile?.username ?? "Primary"} Smart Account`;
      const persistedBaseWallet = await WalletSyncService.persistWalletMetadata({
        userId,
        predictedAddress,
        ownerAddress: passkey.credentialIdRaw,
        walletName,
        chainId: resolvedDeployChainId,
        walletId,
        walletIndex,
        deploymentMode,
      }).catch((error) => {
        console.warn("[Home] Failed to persist predicted wallet metadata", error);
        return null;
      });

      const baseAccount: AAAccount =
        persistedBaseWallet
          ? WalletSyncService.applyWalletToStores(persistedBaseWallet, Boolean(persistedBaseWallet.is_deployed))
          : aaAccount ??
            ({
              id: `local-${userId}`,
              userId,
              walletId,
              walletIndex,
              deploymentMode,
              predictedAddress,
              ownerAddress: passkey.credentialIdRaw,
              isDeployed: false,
              walletName,
              chainId: resolvedDeployChainId,
              createdAt: new Date().toISOString(),
            } as AAAccount);

      setAAAccount({
        ...baseAccount,
        predictedAddress,
        chainId: resolvedDeployChainId,
        walletId,
        walletIndex,
        deploymentMode,
        isDeployed: Boolean(baseAccount.isDeployed),
      });

      setAccountActionStatus(
        "Authenticating and sending deployment UserOperation…",
      );
      const result = await AccountDeploymentService.deployWithPasskeyAuth(
        userId,
        {
          chainId: resolvedDeployChainId,
          passkey,
          walletId,
          walletIndex,
          mode: deploymentMode,
        },
      );

      const deployedAccount: AAAccount = {
        ...baseAccount,
        predictedAddress: result.accountAddress,
        walletId,
        walletIndex,
        deploymentMode,
        ownerAddress: passkey.credentialIdRaw,
        chainId: resolvedDeployChainId,
        isDeployed: true,
        deploymentTxHash: result.alreadyDeployed
          ? baseAccount.deploymentTxHash
          : result.transactionHash,
        deploymentBlockNumber: result.alreadyDeployed
          ? baseAccount.deploymentBlockNumber
          : (result.blockNumber ?? baseAccount.deploymentBlockNumber),
        deployedAt: new Date().toISOString(),
      };

      const persistedDeployedWallet = await WalletSyncService.persistWalletMetadata({
        userId,
        predictedAddress: result.accountAddress,
        ownerAddress: passkey.credentialIdRaw,
        walletName,
        chainId: resolvedDeployChainId,
        walletId,
        walletIndex,
        deploymentMode,
        isDeployed: true,
        deploymentTxHash: result.alreadyDeployed ? undefined : result.transactionHash,
        deploymentBlockNumber:
          result.alreadyDeployed
            ? undefined
            : (result.blockNumber ?? undefined),
        deployedAt: new Date().toISOString(),
      }).catch((error) => {
        console.warn("[Home] Failed to persist deployed wallet metadata", error);
        return null;
      });

      setAAAccount(deployedAccount);
      setSmartAccountAddress(result.accountAddress);
      setSmartAccountDeployed(true);
      if (persistedDeployedWallet) {
        WalletSyncService.applyWalletToStores(persistedDeployedWallet, true);
      }
      if (!result.alreadyDeployed) {
        markAsDeployed(result.transactionHash!, result.blockNumber!);
      }

      let fundingHash: string | null = null;
      try {
        fundingHash = await fundSmartAccount(result.accountAddress, {
          silent: true,
        });
      } catch (fundError) {
        console.warn("[Home] Funding smart account failed", fundError);
      }
      setAccountActionStatus(null);
      Alert.alert(
        "Smart Account Ready",
        `${result.alreadyDeployed ? "Already available at" : "Deployed at"}:\n${result.accountAddress}${
          fundingHash
            ? `\n\nFunded ${DEV_FUNDING_AMOUNT_ETH} ETH\nTx: ${fundingHash.slice(0, 12)}…`
            : ""
        }`,
      );
    } catch (error) {
      setAccountActionStatus(null);
      Alert.alert(
        "Deployment Failed",
        error instanceof Error
          ? error.message
          : "Unable to deploy smart account",
      );
    } finally {
      setDeployingAccount(false);
    }
  }, [
    aaAccount,
    deployingAccount,
    fundSmartAccount,
    markAsDeployed,
    profile?.username,
    resolvedDeployChainId,
    setAAAccount,
    setSmartAccountAddress,
    setSmartAccountDeployed,
    userId,
  ]);

  useEffect(() => {
    fetchMarketData({ chain: activeChain }).catch(() => undefined);
  }, [fetchMarketData, activeChain]);

  useEffect(() => {
    warmCache().catch(() => undefined);
  }, [warmCache]);

  const skeletonData = useMemo(
    () => Array.from({ length: 8 }, (_, index) => index),
    [],
  );
  const activeChainLabel = useMemo(
    () =>
      MARKET_CHAIN_OPTIONS.find((option) => option.key === activeChain)
        ?.label ?? "Selected network",
    [activeChain],
  );

  const filteredTokens = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return tokens;
    }
    return tokens.filter(
      (token) =>
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query),
    );
  }, [searchQuery, tokens]);

  const spotlightTokens = useMemo<TokenBalance[]>(() => {
    // Only show user's actual token holdings from portfolio
    if (portfolio && portfolio.tokens.length > 0) {
      // Get top 5 holdings by value
      const holdings = [...portfolio.tokens]
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      return holdings;
    }
    // Return empty array if no holdings
    return [];
  }, [portfolio]);

  const isInitialLoading = loading && tokens.length === 0;
  const isRefreshing = loading && tokens.length > 0;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isRefreshing) {
      refreshRotation.setValue(0);
      animation = Animated.loop(
        Animated.timing(refreshRotation, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      animation.start();
    } else {
      refreshRotation.stopAnimation(() => {
        refreshRotation.setValue(0);
      });
    }

    return () => {
      animation?.stop();
    };
  }, [isRefreshing, refreshRotation]);

  const refreshSpin = useMemo(
    () => ({
      transform: [
        {
          rotate: refreshRotation.interpolate({
            inputRange: [0, 1],
            outputRange: ["0deg", "360deg"],
          }),
        },
      ],
    }),
    [refreshRotation],
  );

  const handleRefresh = useCallback(() => {
    fetchMarketData({ chain: activeChain, force: true }).catch(() => undefined);
  }, [fetchMarketData, activeChain]);

  const handleSelectChain = useCallback(
    (chain: EvmChain) => {
      if (chain === activeChain) return;
      setActiveChain(chain);
      clearError();
    },
    [activeChain, setActiveChain, clearError],
  );

  const handleRetry = useCallback(() => {
    fetchMarketData({ chain: activeChain, force: true }).catch(() => undefined);
  }, [fetchMarketData, activeChain]);

  const formatPrice = useCallback((value: number) => {
    if (!Number.isFinite(value)) {
      return "$0.00";
    }
    if (value >= 1000) {
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    if (value >= 1) {
      return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    }
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
  }, []);

  const formatChange = useCallback((value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "—";
    }
    const formatted = Math.abs(value).toFixed(2);
    return `${value >= 0 ? "+" : "-"}${formatted}%`;
  }, []);

  const handleTokenPress = useCallback((token: MarketToken) => {
    setSelectedToken(token);
    setTokenDetail(null);
    setDetailError(null);
    setDetailRequestId((value) => value + 1);
  }, []);

  const handleDismissDetail = useCallback(() => {
    detailAbortRef.current?.abort();
    setSelectedToken(null);
    setTokenDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  }, []);

  const handleRetryDetail = useCallback(() => {
    if (!selectedToken) return;
    setDetailRequestId((value) => value + 1);
  }, [selectedToken]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    setActiveAction(action);
  }, []);

  const handleDismissAction = useCallback(() => {
    setActiveAction(null);
  }, []);

  useEffect(() => {
    if (!selectedToken) {
      detailAbortRef.current?.abort();
      setTokenDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    const controller = new AbortController();
    detailAbortRef.current = controller;
    setDetailLoading(true);
    setDetailError(null);

    fetchTokenMarketDetail({
      chain: selectedToken.chain as Exclude<EvmChain, "all">,
      address: selectedToken.address,
      signal: controller.signal,
    })
      .then((detail) => {
        if (!controller.signal.aborted) {
          setTokenDetail(detail);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load token details.";
        setDetailError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedToken, detailRequestId]);

  const renderTokenItem = useCallback(
    ({ item }: { item: MarketToken }) => {
      const change = item.change24h ?? 0;
      const isPositive = change >= 0;

      // Generate a deterministic color for the token logo based on symbol
      const getTokenColor = (symbol: string) => {
        const colors_palette = [
          "#3B82F6",
          "#8B5CF6",
          "#EC4899",
          "#EF4444",
          "#F59E0B",
          "#10B981",
          "#06B6D4",
          "#6366F1",
          "#F97316",
          "#14B8A6",
        ];
        const hash = symbol
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors_palette[hash % colors_palette.length];
      };

      const tokenColor = getTokenColor(item.symbol);

      return (
        <TouchableOpacity
          style={styles.marketCard}
          activeOpacity={0.85}
          onPress={() => handleTokenPress(item)}
        >
          <View style={styles.marketCardRow}>
            <View style={styles.marketTokenInfo}>
              <View
                style={[
                  styles.tokenLogo,
                  {
                    backgroundColor: withAlpha(tokenColor, 0.15),
                    borderColor: withAlpha(tokenColor, 0.3),
                  },
                ]}
              >
                <Text style={[styles.tokenLogoText, { color: tokenColor }]}>
                  {item.symbol.slice(0, 3).toUpperCase()}
                </Text>
              </View>
              <View style={styles.tokenDetails}>
                <Text style={styles.marketName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.marketSymbol} numberOfLines={1}>
                  {item.symbol.toUpperCase()} · {item.network}
                </Text>
              </View>
            </View>
            <View style={styles.tokenPriceInfo}>
              <Text style={styles.marketPrice}>
                {formatPrice(item.priceUsd)}
              </Text>
              <View
                style={[
                  styles.changeChip,
                  {
                    backgroundColor: withAlpha(
                      isPositive ? colors.success : colors.danger,
                      0.12,
                    ),
                  },
                ]}
              >
                <Feather
                  name={isPositive ? "trending-up" : "trending-down"}
                  size={12}
                  color={isPositive ? colors.success : colors.danger}
                />
                <Text
                  style={[
                    styles.marketChange,
                    { color: isPositive ? colors.success : colors.danger },
                  ]}
                >
                  {formatChange(change)}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, formatChange, formatPrice, handleTokenPress, styles],
  );

  const renderSkeletonItem = useCallback(() => <MarketTokenSkeleton />, []);

  const renderEmptyComponent = useCallback(() => {
    if (error) {
      return (
        <View style={styles.marketEmpty}>
          <Text style={[styles.marketEmptyText, { color: colors.danger }]}>
            {error}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.marketRefresh}
            onPress={handleRetry}
          >
            <Feather name="refresh-ccw" size={16} color={colors.accent} />
            <Text style={styles.marketRefreshLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (searchQuery.trim().length > 0) {
      return (
        <View style={styles.marketEmpty}>
          <Text style={styles.marketEmptyText}>
            No tokens match “{searchQuery.trim()}”.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.marketEmpty}>
        <Text style={styles.marketEmptyText}>
          No cached prices for {activeChainLabel} yet.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.marketRefresh}
          onPress={handleRefresh}
        >
          <Feather name="download-cloud" size={16} color={colors.accent} />
          <Text style={styles.marketRefreshLabel}>Load prices</Text>
        </TouchableOpacity>
      </View>
    );
  }, [
    activeChainLabel,
    colors,
    error,
    handleRefresh,
    handleRetry,
    searchQuery,
    styles,
  ]);

  const greetingName =
    profile?.username ??
    (user?.email
      ? user.email.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, " ")
      : undefined) ??
    "Explorer";
  return (
    <TabScreenContainer style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: contentBottomInset }}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet Address Header */}
        <View className="flex-row items-center gap-3 mb-5 mt-3">
          {smartAccountAddress ? (
            <>
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-between bg-surface-elevated rounded-2xl p-3 px-4 border border-border/50"
                onPress={() => setAccountModalVisible(true)}
                activeOpacity={0.7}
              >
                <View className="flex-1">
                  <Text className="text-xs text-text-secondary mb-0.5">
                    Account 1
                  </Text>
                  <Text className="text-[15px] font-semibold text-text-primary font-mono">
                    {smartAccountAddress.slice(0, 6)}...
                    {smartAccountAddress.slice(-4)}
                  </Text>
                </View>
                <Feather
                  name="chevron-down"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className="w-11 h-11 rounded-full bg-surface-elevated items-center justify-center border border-border/50"
                onPress={handleCopyAddress}
                activeOpacity={0.7}
              >
                <Feather name="copy" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-2 bg-warning/10 rounded-2xl p-3 border border-warning/30"
              onPress={() => setAccountModalVisible(true)}
              activeOpacity={0.7}
            >
              <Feather name="alert-triangle" size={16} color={colors.warning} />
              <Text className="text-sm font-semibold text-warning">
                Deploy Smart Account
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => navigation.navigate("AATest")}
            className="w-9 h-9 rounded-full bg-accent/10 items-center justify-center border border-accent/25"
            activeOpacity={0.7}
          >
            <Feather name="zap" size={16} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <LinearGradient colors={gradients.hero} style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Portfolio balance</Text>
              {portfolioLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.accent}
                  style={{ marginTop: 8 }}
                />
              ) : smartAccountAddress ? (
                <Text style={styles.balanceValue}>
                  {PortfolioService.formatUSD(portfolioBalance)}
                </Text>
              ) : (
                <Text style={styles.balanceValue}>
                  Connect a wallet to view balance
                </Text>
              )}
            </View>
          </View>

          {!smartAccountAddress && (
            <Text style={styles.balanceHelper}>
              Deploy your smart account to view balance and manage assets
            </Text>
          )}

          <View style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                activeOpacity={0.85}
                style={styles.quickActionButton}
                onPress={() => handleQuickAction(action)}
              >
                <View style={styles.quickActionIcon}>
                  <Feather name={action.icon} size={18} color={colors.accent} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Spotlight holdings</Text>
        {spotlightTokens.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4, columnGap: 14 }}
          >
            {spotlightTokens.map((token) => (
              <LinearGradient
                key={token.address}
                colors={gradients.card}
                style={styles.assetCard}
              >
                <View style={styles.assetHeader}>
                  <View style={styles.assetBadge}>
                    <Text style={styles.assetBadgeText}>
                      {token.symbol.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.assetAmount}>
                    {token.amount.toFixed(4)}
                  </Text>
                </View>
                <Text style={styles.assetName}>{token.name}</Text>
                <Text style={styles.assetValue}>
                  {formatPrice(token.value)}
                </Text>
                <Text
                  style={styles.assetAllocation}
                >{`@${formatPrice(token.price)}`}</Text>
              </LinearGradient>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noSpotlight}>
            <Text style={styles.noSpotlightText}>
              {aaAccount?.predictedAddress
                ? "Your holdings will appear here once you receive tokens."
                : "Connect a wallet to see your holdings."}
            </Text>
          </View>
        )}

        <View style={styles.marketSection}>
          <View style={styles.marketHeader}>
            <View>
              <Text style={styles.sectionTitle}>Market</Text>
              <Text style={styles.marketMeta}>
                {source
                  ? source === "moralis"
                    ? "Source: Moralis"
                    : "Source: CoinGecko fallback"
                  : "Source syncing…"}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.marketRefreshIconButton}
              onPress={handleRefresh}
              disabled={loading && tokens.length === 0}
            >
              <Animated.View style={isRefreshing ? refreshSpin : undefined}>
                <Feather name="refresh-ccw" size={16} color={colors.accent} />
              </Animated.View>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.marketChainScroller}
          >
            {MARKET_CHAIN_OPTIONS.map((option) => {
              const isActive = option.key === activeChain;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.marketChainPill,
                    isActive && styles.marketChainPillActive,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleSelectChain(option.key)}
                >
                  <Text
                    style={[
                      styles.marketChainLabel,
                      isActive && styles.marketChainLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.marketInfoRow}>
            <Text style={styles.marketMeta}>
              {lastUpdated
                ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
                : `Awaiting data for ${activeChainLabel}`}
            </Text>
            {error && tokens.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.marketErrorPill}
                onPress={handleRetry}
              >
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={styles.marketErrorPillText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.marketSearch}>
            <Feather
              name="search"
              size={16}
              color={withAlpha(colors.textMuted, 0.65)}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by token or symbol"
              placeholderTextColor={withAlpha(colors.textMuted, 0.55)}
              style={styles.marketSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {isInitialLoading ? (
            <FlatList
              data={skeletonData}
              keyExtractor={(item) => `market-skeleton-${item}`}
              renderItem={renderSkeletonItem}
              scrollEnabled={false}
            />
          ) : (
            <FlatList
              data={filteredTokens}
              keyExtractor={(item) => `${item.chain}-${item.address}`}
              renderItem={renderTokenItem}
              scrollEnabled={false}
              ListEmptyComponent={renderEmptyComponent}
            />
          )}
        </View>
      </ScrollView>
      <TokenDetailSheet
        visible={Boolean(selectedToken)}
        token={selectedToken}
        detail={tokenDetail}
        loading={detailLoading}
        error={detailError}
        onClose={handleDismissDetail}
        onRetry={handleRetryDetail}
        formatPrice={formatPrice}
        formatChange={formatChange}
      />
      <QuickActionSheet
        visible={Boolean(activeAction)}
        action={activeAction}
        onDismiss={handleDismissAction}
      />

      {/* Account Modal */}
      <Modal
        transparent
        visible={accountModalVisible}
        animationType="fade"
        onRequestClose={() => setAccountModalVisible(false)}
      >
        <Pressable
          style={styles.accountModalBackdrop}
          onPress={() => setAccountModalVisible(false)}
        >
          <Pressable
            style={styles.accountSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.accountSheetHeader}>
              <View>
                <Text style={styles.accountSheetTitle}>Smart Account</Text>
                <Text
                  style={[
                    styles.accountSheetStatus,
                    !isWalletDeployed && styles.accountSheetStatusWarning,
                  ]}
                >
                  {isWalletDeployed
                    ? "Status: Deployed"
                    : "Status: Not Deployed"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAccountModalVisible(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {accountActionStatus && (
              <View style={styles.accountStatusBanner}>
                {(deployingAccount || fundingAccount) && (
                  <ActivityIndicator size="small" color={colors.accent} />
                )}
                <Text style={styles.accountStatusText}>
                  {accountActionStatus}
                </Text>
              </View>
            )}

            <View style={styles.accountPrimaryActions}>
              {isWalletDeployed ? (
                <View style={styles.accountDeployedBadge}>
                  <Feather
                    name="check-circle"
                    size={18}
                    color={colors.success}
                  />
                  <Text style={styles.accountDeployedText}>
                    Account deployed
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.accountPrimaryButton,
                    deployingAccount && styles.accountSheetButtonDisabled,
                  ]}
                  onPress={handleDeploySmartAccount}
                  disabled={deployingAccount}
                  activeOpacity={0.85}
                >
                  {deployingAccount ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.accountPrimaryButtonLabel}>
                      Deploy Smart Account
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.accountAddressBlock}>
              <Text style={styles.accountAddressLabel}>Account address</Text>
              {smartAccountAddress ? (
                <Text selectable style={styles.accountAddressValue}>
                  {smartAccountAddress}
                </Text>
              ) : (
                <Text style={styles.accountAddressPlaceholder}>
                  Connect or deploy to view your AA address.
                </Text>
              )}
            </View>

            <View style={styles.accountSheetButtons}>
              <TouchableOpacity
                style={[
                  styles.accountSheetButton,
                  !smartAccountAddress && styles.accountSheetButtonDisabled,
                ]}
                onPress={() => {
                  handleCopyAddress();
                  setAccountModalVisible(false);
                }}
                disabled={!smartAccountAddress}
                activeOpacity={0.85}
              >
                <Feather name="copy" size={18} color={colors.accent} />
                <Text style={styles.accountSheetButtonLabel}>Copy address</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.accountSheetButton}
                onPress={() => {
                  setAccountModalVisible(false);
                  navigation.navigate("Profile");
                }}
                activeOpacity={0.85}
              >
                <Feather name="user" size={18} color={colors.accent} />
                <Text style={styles.accountSheetButtonLabel}>View profile</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </TabScreenContainer>
  );
};

type TokenDetailSheetProps = {
  visible: boolean;
  token: MarketToken | null;
  detail: TokenMarketDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  formatPrice: (value: number) => string;
  formatChange: (value: number | null | undefined) => string;
};

const TokenDetailSheet: React.FC<TokenDetailSheetProps> = ({
  visible,
  token,
  detail,
  loading,
  error,
  onClose,
  onRetry,
  formatPrice,
  formatChange,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createTokenDetailStyles(colors), [colors]);

  if (!token) {
    return null;
  }

  const priceSource = detail?.source ?? "coingecko";
  const priceValue = detail?.token.priceUsd ?? token.priceUsd;
  const changeValue = detail?.token.change24h ?? token.change24h;
  const isPositive = (changeValue ?? 0) >= 0;

  const metrics: (
    | { label: string; value: number | null }
    | { label: string; text: string }
  )[] = [
    { label: "Market cap", value: detail?.marketCapUsd ?? null },
    { label: "24h volume", value: detail?.volume24hUsd ?? null },
    { label: "24h high", value: detail?.high24h ?? null },
    { label: "24h low", value: detail?.low24h ?? null },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(event) => {
            event.stopPropagation();
          }}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.tokenBadge}>
                <Text style={styles.tokenBadgeText}>
                  {token.symbol.toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.tokenTitle}>{token.name}</Text>
                <Text style={styles.tokenSubtitle}>{token.network}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={12}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {detail?.image ? (
            <Image
              source={{ uri: detail.image }}
              style={styles.tokenImage}
              resizeMode="contain"
            />
          ) : null}

          <View style={styles.priceRow}>
            <Text style={styles.priceValue}>{formatPrice(priceValue)}</Text>
            <Text
              style={[
                styles.priceChange,
                {
                  color:
                    changeValue == null
                      ? colors.textSecondary
                      : isPositive
                        ? colors.success
                        : colors.danger,
                },
              ]}
            >
              {formatChange(changeValue)}
            </Text>
          </View>

          <Text style={styles.priceSource}>
            Data source: {priceSource === "moralis" ? "Moralis" : "CoinGecko"}
          </Text>

          <View style={styles.metricGrid}>
            {metrics.map((metric) => {
              if ("value" in metric) {
                const value = metric.value;
                return (
                  <View key={metric.label} style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{metric.label}</Text>
                    <Text style={styles.metricValue}>
                      {value != null && Number.isFinite(value)
                        ? formatPrice(value)
                        : "—"}
                    </Text>
                  </View>
                );
              }
              return (
                <View key={metric.label} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={styles.metricValue}>{metric.text}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionTitle}>Overview</Text>
            {loading ? (
              <ActivityIndicator
                color={colors.accent}
                style={{ marginTop: 12 }}
              />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={onRetry}
                  activeOpacity={0.85}
                >
                  <Feather name="refresh-ccw" size={16} color={colors.accent} />
                  <Text style={styles.retryLabel}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView
                style={styles.descriptionScroll}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.descriptionText}>
                  {detail?.description ?? "No project summary available yet."}
                </Text>
              </ScrollView>
            )}
          </View>

          {detail?.lastUpdated ? (
            <Text style={styles.footerMeta}>
              Last updated {new Date(detail.lastUpdated).toLocaleString()}
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

type QuickActionSheetProps = {
  visible: boolean;
  action: QuickAction | null;
  onDismiss: () => void;
};

const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  visible,
  action,
  onDismiss,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createQuickActionStyles(colors), [colors]);

  if (!action) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={styles.sheet}
          onPress={(event) => {
            event.stopPropagation();
          }}
        >
          <View style={styles.iconWrapper}>
            <Feather name={action.icon} size={22} color={colors.accent} />
          </View>
          <Text style={styles.title}>{action.label}</Text>
          <Text style={styles.description}>{action.description}</Text>
          <Text style={styles.helper}>
            Interactive flows are in progress. Check back soon.
          </Text>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.dismissLabel}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createTokenDetailStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.68)",
      justifyContent: "center",
      padding: 24,
    },
    sheet: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: withAlpha(colors.borderMuted, 0.5),
      maxHeight: "88%",
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexShrink: 1,
    },
    tokenBadge: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.accent, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.25),
    },
    tokenBadgeText: {
      color: colors.accent,
      fontWeight: "700",
      fontSize: 13,
      letterSpacing: 0.4,
    },
    tokenTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    tokenSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    closeButton: {
      padding: 6,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.textPrimary, 0.08),
    },
    tokenImage: {
      width: "100%",
      height: 120,
      borderRadius: 16,
      marginBottom: 16,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.4),
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    priceValue: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
    },
    priceChange: {
      fontSize: 14,
      fontWeight: "700",
    },
    priceSource: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 6,
    },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 12,
      marginTop: 18,
    },
    metricCard: {
      backgroundColor: withAlpha(colors.surfaceElevated, 0.4),
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.borderMuted, 0.6),
      width: "48%",
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    descriptionSection: {
      marginTop: 20,
      gap: 12,
      flex: 1,
    },
    descriptionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    descriptionScroll: {
      maxHeight: 160,
    },
    descriptionText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    errorContainer: {
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      textAlign: "center",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.45),
      backgroundColor: withAlpha(colors.accent, 0.12),
    },
    retryLabel: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    footerMeta: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: "center",
      marginTop: 14,
    },
  });

const createQuickActionStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 24,
    },
    sheet: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.borderMuted, 0.5),
      gap: 12,
    },
    iconWrapper: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.accent, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.25),
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    helper: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center",
    },
    dismissButton: {
      marginTop: 6,
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.accent, 0.2),
    },
    dismissLabel: {
      color: colors.accent,
      fontWeight: "700",
      fontSize: 13,
    },
  });

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
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: -16,
      marginTop: -8,
      marginBottom: 8,
      backgroundColor: withAlpha(colors.textPrimary, 0.02),
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.textPrimary, 0.06),
    },
    profileInfo: {
      flex: 1,
      minWidth: 0,
    },
    greetingText: {
      fontSize: 11,
      color: withAlpha(colors.textPrimary, 0.5),
      marginBottom: 2,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    usernameText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      marginBottom: 20,
      marginTop: 12,
    },
    greeting: {
      color: colors.textMuted,
      fontSize: 13,
    },
    greetingName: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    statusPill: {
      marginLeft: "auto",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.32),
    },
    statusPillWarning: {
      borderColor: withAlpha(colors.warning, 0.5),
    },
    statusText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    statusTextWarning: {
      color: colors.warning,
    },
    debugButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: withAlpha(colors.accent, 0.12),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.25),
    },
    balanceCard: {
      borderRadius: 28,
      padding: 22,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.22),
      backgroundColor: colors.surfaceElevated,
    },
    balanceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    balanceLabel: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    balanceValue: {
      color: colors.textPrimary,
      fontSize: 34,
      fontWeight: "800",
      marginTop: 6,
    },
    balanceHelper: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 14,
    },
    deltaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: withAlpha(colors.success, 0.12),
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    deltaText: {
      color: colors.success,
      fontWeight: "700",
      fontSize: 13,
    },
    quickActionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 24,
    },
    quickActionButton: {
      flex: 1,
      alignItems: "center",
      gap: 10,
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: withAlpha(colors.accent, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.25),
      alignItems: "center",
      justifyContent: "center",
    },
    quickActionLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    balanceFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 24,
    },
    footerLabel: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    footerValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 6,
    },
    footerDivider: {
      width: 1,
      height: 40,
      backgroundColor: withAlpha(colors.textMuted, 0.32),
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 14,
    },
    assetCard: {
      padding: 20,
      borderRadius: 22,
      minWidth: 210,
      borderWidth: 1,
      borderColor: colors.border,
    },
    assetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    assetBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.accent, 0.16),
    },
    assetBadgeText: {
      color: colors.accent,
      fontWeight: "700",
      fontSize: 12,
    },
    assetChange: {
      fontWeight: "700",
      fontSize: 13,
    },
    assetAmount: {
      fontWeight: "700",
      fontSize: 13,
      color: colors.textSecondary,
    },
    assetName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 14,
    },
    assetValue: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "700",
      marginTop: 8,
    },
    assetAllocation: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    noSpotlight: {
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.4),
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    noSpotlightText: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 19,
    },
    marketSection: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 26,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      marginTop: 32,
      marginBottom: 120,
    },
    marketHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    marketMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    marketRefreshIconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.accent, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.25),
    },
    marketRefresh: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.28),
      backgroundColor: withAlpha(colors.accent, 0.08),
    },
    marketRefreshLabel: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "600",
    },
    marketChainScroller: {
      paddingHorizontal: 2,
      paddingVertical: 8,
      columnGap: 10,
      marginBottom: 12,
    },
    marketChainPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.4),
    },
    marketChainPillActive: {
      borderColor: withAlpha(colors.accent, 0.55),
      backgroundColor: withAlpha(colors.accent, 0.18),
    },
    marketChainLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    marketChainLabelActive: {
      color: colors.accent,
    },
    marketInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    marketSearch: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      paddingHorizontal: 16,
      paddingVertical: 11,
      marginBottom: 18,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.6),
    },
    marketSearchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
    },
    marketDivider: {
      height: 1,
      backgroundColor: withAlpha(colors.borderMuted, 0.5),
      marginVertical: 2,
    },
    marketCard: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.3),
      borderRadius: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.5),
    },
    marketCardRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    marketTokenInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    tokenLogo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
    },
    tokenLogoText: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    tokenDetails: {
      flex: 1,
    },
    tokenPriceInfo: {
      alignItems: "flex-end",
      gap: 6,
    },
    changeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    marketName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    marketSymbol: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
      letterSpacing: 0.3,
    },
    marketPrice: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    marketChange: {
      fontSize: 12,
      fontWeight: "600",
    },
    marketEmpty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 28,
      gap: 12,
    },
    marketEmptyText: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
    },
    marketErrorPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.35),
      backgroundColor: withAlpha(colors.danger, 0.14),
    },
    marketErrorPillText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "600",
    },
    accountModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(6, 10, 20, 0.55)",
      paddingHorizontal: 18,
      paddingTop: 60,
      justifyContent: "flex-start",
    },
    accountSheet: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      backgroundColor: colors.background,
      borderRadius: 28,
      padding: 20,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.5),
    },
    accountSheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    accountSheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    accountSheetStatus: {
      marginTop: 6,
      fontSize: 13,
      fontWeight: "600",
      color: colors.success,
    },
    accountSheetStatusWarning: {
      color: colors.warning,
    },
    accountAddressBlock: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.6),
      backgroundColor: withAlpha(colors.surfaceElevated, 0.7),
      padding: 16,
      marginBottom: 18,
    },
    accountAddressLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    accountAddressValue: {
      fontFamily: "monospace",
      fontSize: 18,
      color: colors.textPrimary,
      lineHeight: 24,
    },
    accountAddressPlaceholder: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    accountSheetButtons: {
      gap: 12,
    },
    accountSheetButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.25),
      backgroundColor: withAlpha(colors.accent, 0.08),
    },
    accountSheetButtonDisabled: {
      opacity: 0.5,
    },
    accountSheetButtonLabel: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    accountPrimaryActions: {
      gap: 12,
      marginBottom: 12,
    },
    accountPrimaryButton: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    accountPrimaryButtonLabel: {
      color: colors.background,
      fontSize: 15,
      fontWeight: "700",
    },
    accountDeployedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 13,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.success, 0.4),
      backgroundColor: withAlpha(colors.success, 0.12),
      justifyContent: "center",
    },
    accountDeployedText: {
      color: colors.success,
      fontSize: 15,
      fontWeight: "700",
    },
    accountStatusBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.4),
      backgroundColor: withAlpha(colors.accent, 0.1),
      marginBottom: 12,
    },
    accountStatusText: {
      color: colors.accent,
      fontWeight: "600",
      fontSize: 13,
      flex: 1,
    },
  });

export default HomeScreen;
