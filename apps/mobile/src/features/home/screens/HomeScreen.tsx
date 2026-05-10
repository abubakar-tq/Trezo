import { Feather, Ionicons } from "@expo/vector-icons";
import { useNotificationsBootstrap } from "@features/notifications/hooks/useNotificationsBootstrap";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { ActivationSheet } from "@features/wallet/components/ActivationSheet";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import { useActivationSheet } from "@features/wallet/hooks/useActivationSheet";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useWalletData } from "@hooks/useWalletData";
import { useNavigation } from "@react-navigation/native";
import TabScreenContainer from "@shared/components/TabScreenContainer";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import React, { useMemo, useState } from "react";
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
  useNotificationsBootstrap();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  const { isActiveOnChain } = useAccountState();
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const { ref: activationSheetRef, requireActiveOnChain } = useActivationSheet();

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

  const [selectedToken, setSelectedToken] = React.useState<TokenBalance | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [securityTooltipVisible, setSecurityTooltipVisible] = useState(false);

  const handleAssetPress = (token: TokenBalance) => {
    setSelectedToken(token);
    setModalVisible(true);
  };

  const getSecurityStatus = () => {
    if (!smartAccountDeployed) return { color: colors.warning, message: "Account not deployed" };
    if (!hasLocalPasskey) return { color: colors.accentAlt, message: "Passkey not enabled" };
    return { color: colors.success, message: "Fully secured" };
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
        />
      )}

      <ActivationSheet ref={activationSheetRef} />

      {/* Security Tooltip */}
      {securityTooltipVisible && (
        <View style={styles.tooltipOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSecurityTooltipVisible(false)} />
          <View style={[styles.tooltipCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <View style={[styles.tooltipHeader, { borderBottomColor: colors.borderMuted }]}>
              <Ionicons name="shield-checkmark" size={22} color={securityStatus.color} />
              <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>Security Status</Text>
            </View>
            <Text style={[styles.tooltipMessage, { color: colors.textSecondary }]}>
              {securityStatus.message}
            </Text>
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
