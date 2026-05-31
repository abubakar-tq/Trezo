import { Feather, Ionicons } from "@expo/vector-icons";
import { useNotificationsBootstrap } from "@features/notifications/hooks/useNotificationsBootstrap";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { ActivationSheet } from "@features/wallet/components/ActivationSheet";
import { ChainSwitcherChip } from "@features/wallet/components/ChainSwitcherChip";
import { SetUpWalletSheet } from "@features/wallet/components/SetUpWalletSheet";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import { useActivationSheet } from "@features/wallet/hooks/useActivationSheet";
import { useSetUpWalletSheet } from "@features/wallet/hooks/useSetUpWalletSheet";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useWalletData } from "@hooks/useWalletData";
import { useMarketData } from "@hooks/useMarketData";
import { usePortfolioHistory } from "@hooks/usePortfolioHistory";
import { useNavigation } from "@react-navigation/native";
import TabScreenContainer from "@shared/components/TabScreenContainer";
import { FontFamilies } from "@shared/components/TokenRegistry";
import { TokenIcon } from "@shared/components";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import React, { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { SocialRecoveryService } from "@features/wallet/services/SocialRecoveryService";
import {
  describePasskeyAuthority,
  usePasskeyAuthority,
} from "@features/wallet/hooks/usePasskeyAuthority";
import type { SupportedChainId } from "@/src/integration/chains";
import { RecoveryAttemptBanner } from "@shared/components/banners/RecoveryAttemptBanner";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTabContentBottomInset } from "@hooks";
import { useUserStore } from "../../../store/useUserStore";
import { TokenDetailModal } from "../../portfolio/components/TokenDetailModal";
import type { TokenDetailModalHandle } from "../../portfolio/components/TokenDetailModal";
import type { TokenBalance } from "../../portfolio/services/PortfolioService";
import {
  ActionGrid,
  ActivityFeed,
  AssetList,
  BalanceCard,
} from "../components/dashboard";
import type { QuickAction } from "../components/dashboard/ActionGrid";
import { MarketTrendsCarousel } from "../components/dashboard/MarketTrendsCarousel";
import { useAccountManagement } from "../hooks/useAccountManagement";
import { computeTotalChange24h } from "../utils/portfolio24h";

interface HomeScreenProps {
  onSend?: () => void;
  onReceive?: () => void;
  onSecurityCenter?: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = () => {
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const aaAccountAddress = useWalletStore((s) => s.aaAccount?.predictedAddress);
  // Per-chain takes priority over the legacy global. Same pattern as BrowserScreen.
  const effectiveAddress = (aaAccountAddress ?? smartAccountAddress) as string | null;
  const userId = useUserStore((state) => state.user?.id);
  useNotificationsBootstrap();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const { isActiveOnChain, isProvisioned } = useAccountState();
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const { ref: activationSheetRef, requireActiveOnChain } = useActivationSheet();
  const { ref: setUpRef, requireProvisioned } = useSetUpWalletSheet();

  const handleActionPress = (action: QuickAction) => {
    // Receive does NOT gate via Activation sheet
    if (action.key === "receive") {
      navigation.navigate("Receive");
      return;
    }
    const isActive = isActiveOnChain(activeChainId);
    requireActiveOnChain(activeChainId, isActive, () => {
      if (action.key === "swap" || action.key === "bridge") {
        navigation.navigate("Dex", { initialTab: action.key });
      } else if (action.key === "buy") {
        navigation.navigate("Buy");
      } else if (action.key === "send") {
        navigation.navigate("Send");
      }
    });
  };

  const { totalBalanceUSD, tokens, isLoading: walletLoading, missingPrices } = useWalletData(effectiveAddress ?? undefined);
  const { isHydrating, hasLocalPasskey } = useAccountManagement();
  const contentBottomInset = useTabContentBottomInset();

  // Market feed — used for 24h change per token (join holdings to market by symbol)
  const { assets: marketAssets } = useMarketData(20);

  // 24h change map: symbol (uppercase) → changePercent24Hr from market feed
  const change24hBySymbol = useMemo(() => {
    const map: Record<string, number> = {};
    marketAssets.forEach((a) => {
      const pct = parseFloat(a.changePercent24Hr);
      if (isFinite(pct)) map[a.symbol.toUpperCase()] = pct;
    });
    return map;
  }, [marketAssets]);

  // Build token list from wallet data for display
  const displayTokens = useMemo((): TokenBalance[] => {
    return tokens.map((t) => {
      const sym = (t.symbol || "UNKNOWN").toUpperCase();
      const realChange = change24hBySymbol[sym];
      return {
        symbol: t.symbol || "UNKNOWN",
        name: t.name || "Unknown Token",
        amount: parseFloat(t.balance_formatted || t.balance || "0"),
        price: t.usd_price || 0,
        value: t.usd_value || 0,
        // Real 24h % from market feed — omit entirely when unknown (never fabricate 0)
        ...(realChange !== undefined ? { change24h: realChange } : {}),
        decimals: t.decimals || 18,
        address: (t.token_address || "native") as `0x${string}`,
      };
    });
  // change24hBySymbol is a dependency because we use it to set change24h per token
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, change24hBySymbol]);

  // Sorted by value DESC (top holdings first)
  const sortedTokens = useMemo(
    () => [...displayTokens].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    [displayTokens]
  );

  // Real portfolio 24h change — computed from market feed joined to holdings.
  // Returns null when no holding has a known 24h % → badge renders nothing.
  const portfolioChange24h = useMemo(() => {
    const holdings = displayTokens.map((t) => ({
      value: t.value ?? 0,
      changePct24h: change24hBySymbol[t.symbol.toUpperCase()] ?? null,
    }));
    return computeTotalChange24h(holdings);
  }, [displayTokens, change24hBySymbol]);

  // On-chain authority — the truth source.
  const passkeyAuthority = usePasskeyAuthority({
    userId,
    smartAccountAddress: effectiveAddress as Address | null,
    chainId: activeChainId as SupportedChainId | null | undefined,
  });

  const tokenDetailRef = React.useRef<TokenDetailModalHandle>(null);
  const [securityTooltipVisible, setSecurityTooltipVisible] = useState(false);

  type RecoverySnapshot = {
    guardians: readonly Address[];
    threshold: bigint;
    timelockSeconds: bigint;
    nonce: bigint;
    activeRecoveryId: string;
    executeAfter: bigint;
  };
  const [recoverySnap, setRecoverySnap] = useState<RecoverySnapshot | null>(null);
  const [recoverySnapErr, setRecoverySnapErr] = useState<string | null>(null);
  const [recoverySnapLoading, setRecoverySnapLoading] = useState(false);

  useEffect(() => {
    if (!securityTooltipVisible || !effectiveAddress || !activeChainId) return;
    let cancelled = false;
    setRecoverySnapLoading(true);
    setRecoverySnapErr(null);
    Promise.all([
      SocialRecoveryService.getRecoveryDetails(effectiveAddress as Address, activeChainId as SupportedChainId),
      SocialRecoveryService.getRecoveryNonce(effectiveAddress as Address, activeChainId as SupportedChainId),
      SocialRecoveryService.getActiveRecovery(effectiveAddress as Address, activeChainId as SupportedChainId),
    ])
      .then(([details, nonce, active]) => {
        if (cancelled) return;
        setRecoverySnap({
          guardians: details.guardians,
          threshold: details.threshold,
          timelockSeconds: details.timelockSeconds,
          nonce,
          activeRecoveryId: active?.recoveryId ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
          executeAfter: active?.executeAfter ?? 0n,
        });
      })
      .catch((err) => {
        if (!cancelled) setRecoverySnapErr(err?.message ?? "Failed to read on-chain state");
      })
      .finally(() => {
        if (!cancelled) setRecoverySnapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [securityTooltipVisible, effectiveAddress, activeChainId]);

  const handleAssetPress = (token: TokenBalance) => {
    tokenDetailRef.current?.open(token);
  };

  const getSecurityStatus = () => {
    if (!smartAccountDeployed) return { color: colors.warning, message: "Account not deployed" };
    if (passkeyAuthority.loading) {
      return hasLocalPasskey
        ? { color: colors.textMuted, message: "Verifying passkey authority…" }
        : { color: colors.accentAlt, message: "Passkey not enabled" };
    }
    if (passkeyAuthority.status === "authoritative") {
      return { color: colors.success, message: "Fully secured" };
    }
    if (passkeyAuthority.status === "no_local") {
      return { color: colors.accentAlt, message: "Passkey not enabled on this device" };
    }
    if (passkeyAuthority.status === "not_registered" || passkeyAuthority.status === "stale_keys") {
      return {
        color: colors.danger,
        message: "Local passkey not authoritative on-chain — recovery needed",
      };
    }
    if (passkeyAuthority.status === "wallet_undeployed") {
      return { color: colors.warning, message: "Wallet not deployed on this chain" };
    }
    return { color: colors.textMuted, message: "Security status unavailable" };
  };

  const securityStatus = getSecurityStatus();

  // Keyed on holdings: $0 with no tokens = empty state
  const isEmpty = !walletLoading && totalBalanceUSD === 0;

  // 1D portfolio sparkline — real data only (current holdings × intraday prices)
  // Uses the same hook as PortfolioScreen for consistency.
  const { history: sparklineHistory } = usePortfolioHistory(displayTokens, "1D");

  // Valid sparkline series: ≥2 finite points, non-empty wallet (never show in $0 state)
  const sparklineData: number[] | undefined = useMemo(() => {
    if (isEmpty) return undefined;
    const valid = sparklineHistory.filter(isFinite);
    return valid.length >= 2 ? valid : undefined;
  }, [isEmpty, sparklineHistory]);

  // Format price for AssetList
  const formatPrice = (value: number) =>
    value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

  return (
    <TabScreenContainer includeBottomInset>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomInset + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Slim Header ───────────────────────────────────────────────────
            Spec §5.1: small wordmark left; ChainSwitcherChip + bell right.
            Kill the big WALLET/TREZO ALL-CAPS block.
        ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerWordmark, { color: colors.textPrimary }]}>trezo</Text>
            <ChainSwitcherChip
              onError={(message) => Alert.alert("Could not switch chain", message)}
            />
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setSecurityTooltipVisible(true)}
              style={[styles.headerBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark" size={18} color={securityStatus.color} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              style={[styles.headerBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Feather name="bell" size={18} color={colors.textPrimary} />
              {unreadCount > 0 && (
                <View style={[styles.notiDot, { backgroundColor: colors.accentAlt, borderColor: colors.background }]} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Recovery Attempt banner — dismissable, Supabase-only, no RPC */}
        <RecoveryAttemptBanner smartAccountAddress={effectiveAddress as Address | undefined} />

        {/* ── Balance Hero ──────────────────────────────────────────────────
            Funded: brand gradient + real 24h change badge.
            Empty:  flat card, $0.00, no badge.
        ── */}
        <View style={styles.balanceWrapper}>
          <BalanceCard
            balance={totalBalanceUSD}
            loading={walletLoading}
            address={effectiveAddress ?? undefined}
            isDeployed={isActiveOnChain(activeChainId)}
            isHydrating={isHydrating}
            hasLocalPasskey={hasLocalPasskey}
            missingPrices={missingPrices}
            change24hPct={portfolioChange24h?.pct ?? null}
            isEmpty={isEmpty}
            sparklineData={sparklineData}
            onDeploy={() => navigation.navigate("DeployAccount")}
            onEnablePasskey={() => navigation.navigate("RecoveryEntry")}
          />
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────────────
            Funded: Receive + Send primary; Swap + Buy secondary.
            Empty:  Receive + Buy primary; Send + Swap disabled.
        ── */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <ActionGrid onActionPress={handleActionPress} isEmpty={isEmpty} />
          </View>
        </View>

        {isEmpty ? (
          /* ── EMPTY STATE body ─────────────────────────────────────────── */
          <>
            {/* "Fund your wallet" card */}
            <View style={styles.sectionWrapper}>
              <View style={[styles.fundCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <View style={[styles.fundIconBox, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}22` }]}>
                  <Feather name="inbox" size={24} color={colors.accent} />
                </View>
                <View style={styles.fundTextBlock}>
                  <Text style={[styles.fundTitle, { color: colors.textPrimary }]}>Fund your wallet</Text>
                  <Text style={[styles.fundSubtitle, { color: colors.textSecondary }]}>
                    Receive ETH to start using Trezo on testnet.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.fundCta, { backgroundColor: colors.accent }]}
                  onPress={() => navigation.navigate("Receive")}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.fundCtaText, { color: colors.textPrimary }]}>Receive</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Single native ETH row at 0.00 — the gas asset (spec §5.1 EMPTY) */}
            <View style={styles.sectionWrapper}>
              <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your Assets</Text>
                </View>
                <View style={styles.ethRow}>
                  <TokenIcon symbol="ETH" size={44} style={{ borderRadius: 12 }} />
                  <View style={styles.ethInfo}>
                    <Text style={[styles.ethSymbol, { color: colors.textPrimary }]}>ETH</Text>
                    <Text style={[styles.ethName, { color: colors.textSecondary }]}>Ethereum</Text>
                  </View>
                  <View style={styles.ethRight}>
                    <Text style={[styles.ethValue, { color: colors.textMuted }]}>$0.00</Text>
                    <Text style={[styles.ethAmount, { color: colors.textMuted }]}>0.00</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : (
          /* ── FUNDED STATE body ────────────────────────────────────────── */
          <>
            {/* YOUR ASSETS */}
            {sortedTokens.length > 0 && (
              <View style={styles.sectionWrapper}>
                <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your Assets</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("Portfolio")} activeOpacity={0.7}>
                      <Text style={[styles.seeAllLink, { color: colors.accent }]}>See all →</Text>
                    </TouchableOpacity>
                  </View>
                  <AssetList
                    assets={sortedTokens.slice(0, 5)}
                    predictedAddress={effectiveAddress}
                    formatPrice={formatPrice}
                    onAssetPress={handleAssetPress}
                    change24hBySymbol={change24hBySymbol}
                  />
                </View>
              </View>
            )}

            {/* RECENT ACTIVITY */}
            <View style={styles.sectionWrapper}>
              <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Recent Activity</Text>
                  <TouchableOpacity onPress={() => navigation.navigate("TransactionHistory")} activeOpacity={0.7}>
                    <Text style={[styles.seeAllLink, { color: colors.accent }]}>See all →</Text>
                  </TouchableOpacity>
                </View>
                <ActivityFeed limit={3} />
              </View>
            </View>
          </>
        )}

        {/* ── Trending — ONE compact bottom shelf (spec §5.1 point 6) ──── */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Trending</Text>
            </View>
            <MarketTrendsCarousel onTokenPress={handleAssetPress} />
          </View>
        </View>
      </ScrollView>

      <TokenDetailModal
        ref={tokenDetailRef}
        onRequestSend={(t) =>
          requireActiveOnChain(activeChainId, isActiveOnChain(activeChainId), () =>
            navigation.navigate('Send', { tokenSymbol: t.symbol }),
          )
        }
        onRequestReceive={() => requireProvisioned(isProvisioned, () => navigation.navigate('Receive'))}
        onRequestSwap={(preselect) =>
          requireActiveOnChain(activeChainId, isActiveOnChain(activeChainId), () =>
            navigation.navigate('Dex', { initialTab: 'swap', preselect }),
          )
        }
      />

      <ActivationSheet ref={activationSheetRef} />
      <SetUpWalletSheet ref={setUpRef} />

      {/* Security Tooltip — live on-chain recovery state */}
      {securityTooltipVisible && (
        <View style={styles.tooltipOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSecurityTooltipVisible(false)} />
          <View style={[styles.tooltipCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <View style={[styles.tooltipHeader, { borderBottomColor: colors.borderMuted }]}>
              <Ionicons name="shield-checkmark" size={22} color={securityStatus.color} />
              <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>Security Status</Text>
            </View>

            <Text style={[styles.tooltipMessage, { color: colors.textSecondary, marginBottom: 12 }]}>
              {securityStatus.message}
            </Text>

            {!passkeyAuthority.loading && (() => {
              const desc = describePasskeyAuthority(passkeyAuthority.status);
              const bg =
                desc.severity === "ok" ? `${colors.success}1A`
                : desc.severity === "error" ? `${colors.danger}1A`
                : desc.severity === "warn" ? `${colors.warning}1A`
                : `${colors.accent}1A`;
              const fg =
                desc.severity === "ok" ? colors.success
                : desc.severity === "error" ? colors.danger
                : desc.severity === "warn" ? colors.warning
                : colors.accent;
              return (
                <View style={{ backgroundColor: bg, padding: 10, borderRadius: 12, marginBottom: 12 }}>
                  <Text style={[styles.tooltipMessage, { color: fg, fontWeight: "700", marginBottom: 4 }]}>
                    {desc.title}
                  </Text>
                  <Text style={[styles.tooltipMessage, { color: fg, fontSize: 12 }]}>
                    {desc.body}
                  </Text>
                </View>
              );
            })()}

            {recoverySnapLoading && (
              <Text style={[styles.tooltipMessage, { color: colors.textMuted, fontStyle: "italic" }]}>
                Reading on-chain state…
              </Text>
            )}
            {recoverySnapErr && !recoverySnapLoading && (
              <Text style={[styles.tooltipMessage, { color: colors.danger }]}>
                Could not read on-chain state: {recoverySnapErr}
              </Text>
            )}
            {recoverySnap && !recoverySnapLoading && (
              <View style={{ gap: 6, marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.tooltipMessage, { color: colors.textMuted }]}>Guardians</Text>
                  <Text style={[styles.tooltipMessage, { color: colors.textPrimary, fontWeight: "700" }]}>
                    {recoverySnap.guardians.length === 0
                      ? "none on-chain"
                      : `${recoverySnap.threshold.toString()}-of-${recoverySnap.guardians.length}`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.tooltipMessage, { color: colors.textMuted }]}>Timelock</Text>
                  <Text style={[styles.tooltipMessage, { color: colors.textPrimary, fontWeight: "700" }]}>
                    {recoverySnap.timelockSeconds === 0n
                      ? "—"
                      : recoverySnap.timelockSeconds >= 86400n
                      ? `${Number(recoverySnap.timelockSeconds / 86400n)}d`
                      : recoverySnap.timelockSeconds >= 3600n
                      ? `${Number(recoverySnap.timelockSeconds / 3600n)}h`
                      : `${Number(recoverySnap.timelockSeconds / 60n)}min`}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.tooltipMessage, { color: colors.textMuted }]}>Recoveries executed</Text>
                  <Text style={[styles.tooltipMessage, { color: colors.textPrimary, fontWeight: "700" }]}>
                    {recoverySnap.nonce.toString()}
                  </Text>
                </View>
                {recoverySnap.executeAfter > 0n && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      backgroundColor: `${colors.warning}1A`,
                      padding: 8,
                      borderRadius: 8,
                      marginTop: 4,
                    }}
                  >
                    <Text style={[styles.tooltipMessage, { color: colors.warning, fontWeight: "700" }]}>
                      Recovery pending
                    </Text>
                    <Text style={[styles.tooltipMessage, { color: colors.warning }]}>
                      executes {new Date(Number(recoverySnap.executeAfter) * 1000).toLocaleString()}
                    </Text>
                  </View>
                )}
                {recoverySnap.nonce > 0n && recoverySnap.executeAfter === 0n && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      backgroundColor: `${colors.success}1A`,
                      padding: 8,
                      borderRadius: 8,
                      marginTop: 4,
                    }}
                  >
                    <Text style={[styles.tooltipMessage, { color: colors.success, fontWeight: "700" }]}>
                      ✓ Recovery completed — passkey rotated
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Pressable
              style={[styles.tooltipBtn, { backgroundColor: colors.accent }]}
              onPress={() => setSecurityTooltipVisible(false)}
            >
              <Text style={[styles.tooltipBtnLabel, { color: colors.textOnAccent }]}>OK</Text>
            </Pressable>
          </View>
        </View>
      )}
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 8,
    },

    // ── Slim header ────────────────────────────────────────────────────────
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginBottom: 4,
    },
    headerLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    // Small wordmark — replaces the big WALLET / TREZO ALL-CAPS block
    headerWordmark: {
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 2,
      fontFamily: FontFamilies.sansBlack,
      textTransform: "lowercase",
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerBtn: {
      width: 42,
      height: 42,
      // Spec §3: radius scale — 12 for chips/inputs
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
    },
    notiDot: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 2,
    },

    // ── Balance card ────────────────────────────────────────────────────────
    balanceWrapper: {
      marginHorizontal: 20,
      marginBottom: 20,
    },

    // ── Section layout ──────────────────────────────────────────────────────
    sectionWrapper: {
      marginHorizontal: 20,
      marginBottom: 16,
    },
    sectionCard: {
      // Spec §3: radius scale — 20 for glass-details / cards (was offending 22)
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderWidth: 1,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    seeAllLink: {
      fontSize: 13,
      fontWeight: "600",
    },

    // ── Empty state — Fund Your Wallet card ─────────────────────────────────
    fundCard: {
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 20,
      borderWidth: 1,
      gap: 12,
    },
    fundIconBox: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    fundTextBlock: {
      gap: 4,
    },
    fundTitle: {
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: -0.2,
    },
    fundSubtitle: {
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 18,
    },
    fundCta: {
      alignSelf: "flex-start",
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
    },
    fundCtaText: {
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.3,
    },

    // ── Empty state — native ETH row ────────────────────────────────────────
    ethRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    ethInfo: {
      flex: 1,
      gap: 2,
    },
    ethSymbol: {
      fontSize: 16,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    ethName: {
      fontSize: 12,
      fontWeight: "600",
    },
    ethRight: {
      alignItems: "flex-end",
      gap: 2,
    },
    ethValue: {
      fontSize: 16,
      fontWeight: "700",
      fontFamily: FontFamilies.mono,
    },
    ethAmount: {
      fontSize: 12,
      fontFamily: FontFamilies.mono,
    },

    // ── Security tooltip ────────────────────────────────────────────────────
    tooltipOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    tooltipCard: {
      width: "100%",
      // Spec §3: 20 for modals
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      gap: 12,
    },
    tooltipHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tooltipTitle: {
      fontSize: 17,
      fontWeight: "700",
    },
    tooltipMessage: {
      fontSize: 14,
      lineHeight: 21,
    },
    tooltipBtn: {
      paddingVertical: 13,
      // Spec §3: 999 for primary pill
      borderRadius: 999,
      alignItems: "center",
      marginTop: 4,
    },
    tooltipBtnLabel: {
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default HomeScreen;
