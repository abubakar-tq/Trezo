import { Feather, Ionicons } from "@expo/vector-icons";
import { useNotificationsBootstrap } from "@features/notifications/hooks/useNotificationsBootstrap";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { ActivationSheet } from "@features/wallet/components/ActivationSheet";
import { SetUpWalletSheet } from "@features/wallet/components/SetUpWalletSheet";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import { useActivationSheet } from "@features/wallet/hooks/useActivationSheet";
import { useSetUpWalletSheet } from "@features/wallet/hooks/useSetUpWalletSheet";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useWalletData } from "@hooks/useWalletData";
import { useNavigation } from "@react-navigation/native";
import TabScreenContainer from "@shared/components/TabScreenContainer";
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
import {
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
import type { TokenBalance } from "../../portfolio/services/PortfolioService";
import {
  ActionGrid,
  ActivityFeed,
  BalanceCard,
} from "../components/dashboard";
import type { QuickAction } from "../components/dashboard/ActionGrid";
import { MarketTrendsCarousel } from "../components/dashboard/MarketTrendsCarousel";
import { useAccountManagement } from "../hooks/useAccountManagement";

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
  const userId = useUserStore((state) => state.user?.id);
  useNotificationsBootstrap();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const { isActiveOnChain, isProvisioned } = useAccountState();
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const { ref: activationSheetRef, requireActiveOnChain } = useActivationSheet();
  const { ref: setUpRef, requireProvisioned } = useSetUpWalletSheet();

  const handleActionPress = (action: QuickAction) => {
    // Receive does NOT gate via Activation sheet — Phase 6 will wire Set-Up for that.
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

  const { totalBalanceUSD, isLoading: walletLoading, missingPrices } = useWalletData(smartAccountAddress ?? undefined);
  const { isHydrating, hasLocalPasskey } = useAccountManagement();
  const contentBottomInset = useTabContentBottomInset();

  // On-chain authority — the truth source. The shield color and security
  // tooltip both follow this; we no longer trust hasLocalPasskey alone.
  const passkeyAuthority = usePasskeyAuthority({
    userId,
    smartAccountAddress: smartAccountAddress as Address | null,
    chainId: activeChainId as SupportedChainId | null | undefined,
  });

  const [selectedToken, setSelectedToken] = React.useState<TokenBalance | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [securityTooltipVisible, setSecurityTooltipVisible] = useState(false);

  // Live on-chain recovery state shown when the user taps the shield. Loaded
  // each time the tooltip opens so it always reflects the current chain state
  // (no caching pitfalls).
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
    if (!securityTooltipVisible || !smartAccountAddress || !activeChainId) return;
    let cancelled = false;
    setRecoverySnapLoading(true);
    setRecoverySnapErr(null);
    Promise.all([
      SocialRecoveryService.getRecoveryDetails(smartAccountAddress as Address, activeChainId as SupportedChainId),
      SocialRecoveryService.getRecoveryNonce(smartAccountAddress as Address, activeChainId as SupportedChainId),
      SocialRecoveryService.getActiveRecovery(smartAccountAddress as Address, activeChainId as SupportedChainId),
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
  }, [securityTooltipVisible, smartAccountAddress, activeChainId]);

  const handleAssetPress = (token: TokenBalance) => {
    setSelectedToken(token);
    setModalVisible(true);
  };

  const getSecurityStatus = () => {
    if (!smartAccountDeployed) return { color: colors.warning, message: "Account not deployed" };
    if (passkeyAuthority.loading) {
      // While checking, keep the previous green/amber from local presence as a
      // gentle placeholder — never lie green after the check has returned.
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

  return (
    <TabScreenContainer includeBottomInset>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomInset + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerKicker}>WALLET</Text>
            <Text style={styles.headerBrand}>TREZO</Text>
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

        {/* Balance Card */}
        <View style={styles.balanceWrapper}>
          <BalanceCard
            balance={totalBalanceUSD}
            loading={walletLoading}
            address={smartAccountAddress ?? undefined}
            isDeployed={smartAccountDeployed}
            isHydrating={isHydrating}
            hasLocalPasskey={hasLocalPasskey}
            missingPrices={missingPrices}
            onDeploy={() => navigation.navigate("DeployAccount")}
            onEnablePasskey={() => navigation.navigate("RecoveryEntry")}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>QUICK ACTIONS</Text>
            <ActionGrid onActionPress={handleActionPress} />
          </View>
        </View>

        {/* Market Trends */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MARKET TRENDS</Text>
            <MarketTrendsCarousel onTokenPress={handleAssetPress} />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.sectionCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>RECENT ACTIVITY</Text>
            <ActivityFeed limit={3} />
          </View>
        </View>
      </ScrollView>

      {selectedToken && (
        <TokenDetailModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          token={selectedToken}
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
      )}

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

            {/* Passkey authority — the actual sign-ability check */}
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
                <View style={{ backgroundColor: bg, padding: 10, borderRadius: 10, marginBottom: 12 }}>
                  <Text style={[styles.tooltipMessage, { color: fg, fontWeight: "700", marginBottom: 4 }]}>
                    {desc.title}
                  </Text>
                  <Text style={[styles.tooltipMessage, { color: fg, fontSize: 12 }]}>
                    {desc.body}
                  </Text>
                </View>
              );
            })()}

            {/* Live on-chain readout */}
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginBottom: 4,
    },
    headerKicker: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 2,
      color: colors.textMuted,
    },
    headerBrand: {
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: -0.5,
      color: colors.textPrimary,
      lineHeight: 30,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerBtn: {
      width: 42,
      height: 42,
      borderRadius: 13,
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
    balanceWrapper: {
      marginHorizontal: 20,
      marginBottom: 20,
    },
    sectionWrapper: {
      marginHorizontal: 20,
      marginBottom: 16,
    },
    sectionCard: {
      borderRadius: 22,
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderWidth: 1,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.4,
      marginBottom: 14,
    },
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
      borderRadius: 13,
      alignItems: "center",
      marginTop: 4,
    },
    tooltipBtnLabel: {
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default HomeScreen;
