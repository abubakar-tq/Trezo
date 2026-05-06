import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNotificationsBootstrap } from "@features/notifications/hooks/useNotificationsBootstrap";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { useWalletData } from "@hooks/useWalletData";
import { useNavigation } from "@react-navigation/native";
import { MeshBackground } from "@shared/components/MeshBackground";
import TabScreenContainer from "@shared/components/TabScreenContainer";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from "react";
import {
    Dimensions,
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
import { MarketExplorer } from "../components/dashboard/MarketExplorer";
import { useAccountManagement } from "../hooks/useAccountManagement";

const { width } = Dimensions.get("window");

interface HomeScreenProps {
  onSend?: () => void;
  onReceive?: () => void;
  onSecurityCenter?: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  onSend,
  onReceive,
  onSecurityCenter,
}) => {
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  
  // Live wallet state from store (replaces hardcoded placeholder)
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const { accounts, activeAccount, setActiveAccount } = useWalletStore();

  useNotificationsBootstrap();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  
  const { totalBalanceUSD, tokens, isLoading: walletLoading } = useWalletData(smartAccountAddress ?? undefined);

  const { isHydrating, hasLocalPasskey } = useAccountManagement();
  const contentBottomInset = useTabContentBottomInset();

  const [selectedToken, setSelectedToken] = React.useState<TokenBalance | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [securityTooltipVisible, setSecurityTooltipVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = React.useState(false);

  const handleAccountSelect = (account: any) => {
    // Map the Account type from modal to WalletAccount type from store if needed
    const walletAccount: any = {
      address: account.address,
      name: account.name,
      isActive: true,
      createdAt: account.createdAt || new Date().toISOString()
    };
    setActiveAccount(walletAccount);
    setIsAccountPickerVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Use live data
  const portfolioBalance = totalBalanceUSD;
  const portfolioLoading = walletLoading;

  const handleAssetPress = (token: TokenBalance) => {
    setSelectedToken(token);
    setModalVisible(true);
  };

  // Map Moralis tokens to AssetList format
  const displayTokens: TokenBalance[] = useMemo(() => {
    return tokens.map((t: any) => ({
      symbol: t.symbol,
      name: t.name,
      // balance_formatted is now always set; fallback to balance for safety
      amount: parseFloat(t.balance_formatted ?? t.balance ?? "0"),
      price: t.usd_price || 0,
      value: t.usd_value || 0,
      change24h: 0,
      address: t.token_address || "0x"
    }));
  }, [tokens]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Get security status for icon color
  const getSecurityStatus = () => {
    if (!smartAccountDeployed) return { color: colors.warning, message: 'Account not deployed' };
    if (!hasLocalPasskey) return { color: colors.accentAlt, message: 'Passkey not enabled' };
    return { color: colors.success, message: 'Fully secured' };
  };

  const securityStatus = getSecurityStatus();

  return (
    <TabScreenContainer includeBottomInset>
      <MeshBackground />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.brandName, { color: colors.textPrimary }]}>TREZO</Text>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={() => setSecurityTooltipVisible(true)}
              style={[styles.headerAction, { backgroundColor: colors.glass }]}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark" size={18} color={securityStatus.color} />
            </TouchableOpacity>

            <View style={[styles.statusBadge, { backgroundColor: withAlpha(smartAccountDeployed ? colors.success : colors.warning, 0.12) }]}>
              <View style={[styles.statusDot, { backgroundColor: smartAccountDeployed ? colors.success : colors.warning }]} />
              <Text style={[styles.statusText, { color: smartAccountDeployed ? colors.success : colors.warning }]}>
                {smartAccountDeployed ? 'Active' : 'Unactivated'}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={() => navigation.navigate("Notifications")}
              style={[styles.headerAction, { backgroundColor: colors.glass }]}
              activeOpacity={0.7}
            >
              <Feather name="bell" size={18} color={colors.textPrimary} strokeWidth={1.5} />
              {unreadCount > 0 ? (
                <View style={[styles.notiDot, { backgroundColor: colors.accentAlt, borderColor: colors.background }]} />
              ) : null}
            </TouchableOpacity>
          </View>
        </View>


        {/* Integrated Sections with Zero Depth to fix Android Gray Line */}
        <View style={styles.sectionWrapper}>
          <BalanceCard
            balance={portfolioBalance}
            loading={portfolioLoading}
            address={smartAccountAddress ?? undefined}
            isDeployed={smartAccountDeployed}
            isHydrating={isHydrating}
            hasLocalPasskey={hasLocalPasskey}
            onDeploy={() => navigation.navigate("DeployAccount")}
            onEnablePasskey={() => navigation.navigate("RecoveryEntry")}
          />
        </View>

        <View style={styles.sectionWrapper}>
          <View style={[styles.glassSection, styles.glassSectionAction, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 12 }]}>Quick Actions</Text>
            <ActionGrid onActionPress={(action) => {
              if (action.key === 'swap' || action.key === 'bridge') {
                navigation.navigate('Dex', { initialTab: action.key });
              } else {
                const screenName = action.key.charAt(0).toUpperCase() + action.key.slice(1);
                navigation.navigate(screenName);
              }
            }} />
          </View>
        </View>


        {/* Market Trends - Unified Header */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.glassSection, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 12 }]}>Market Trends</Text>
            <MarketExplorer onTokenPress={handleAssetPress} />
          </View>
        </View>


        <View style={styles.sectionWrapper}>
          <View style={[styles.glassSection, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent Activity</Text>
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

      {/* Security Status Tooltip */}
      {securityTooltipVisible && (
        <View style={[styles.tooltipOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
          <TouchableOpacity 
            style={styles.tooltipBackdrop}
            onPress={() => setSecurityTooltipVisible(false)}
          />
          <View style={[styles.tooltipContainer, { backgroundColor: colors.surfaceCard }]}>
            <View style={[styles.tooltipHeader, { borderBottomColor: colors.border }]}>
              <Ionicons name="shield-checkmark" size={24} color={securityStatus.color} />
              <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>
                Security Status
              </Text>
            </View>
            <Text style={[styles.tooltipMessage, { color: colors.textSecondary }]}>
              {securityStatus.message}
            </Text>
            <TouchableOpacity 
              style={[styles.tooltipButton, { backgroundColor: colors.accent }]}
              onPress={() => setSecurityTooltipVisible(false)}
            >
              <Text style={[styles.tooltipButtonText, { color: '#fff' }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  brandName: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
    borderColor: 'transparent',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent', // Will be overridden if needed
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notiDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  searchWrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  searchText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionWrapper: {
    marginBottom: 20,
    marginHorizontal: 20,
  },
  glassSection: {
    borderRadius: 20,
    paddingVertical: 22, // 30% reduction from 32
    paddingHorizontal: 25, // 30% reduction from 36
    borderWidth: 1,
    // Ultimate Borderless Fix: Zero depth on Android to remove gray rim
    shadowOpacity: 0,
    elevation: 0, 
    overflow: 'visible',
  },
  glassSectionAction: {
    paddingVertical: 10, // 35% reduction from 16
    paddingHorizontal: 18, // 50% reduction from 36
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  accountTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 6,
  },
  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000',
  },
  tooltipOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  tooltipContainer: {
    width: 280,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tooltipTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  tooltipMessage: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 16,
  },
  tooltipButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  tooltipButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default HomeScreen;
