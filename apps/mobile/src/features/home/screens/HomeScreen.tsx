import React, { useMemo, useCallback } from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Modal, 
  Pressable, 
  ActivityIndicator,
  Clipboard,
  Alert
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { TabScreenContainer } from "@shared/components";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

// Hooks
import { useDashboardData } from "../hooks/useDashboardData";
import { useAccountManagement } from "../hooks/useAccountManagement";
import { useTabContentBottomInset } from "@app/hooks";

// Components
import { BalanceCard, ActionGrid, AssetList, ActivityFeed } from "../components/dashboard";
import { MarketSection } from "../components/dashboard/MarketSection";
import TokenDetailSheet from "../components/Market/TokenDetailSheet";
import QuickActionSheet from "../components/ActionSheet/QuickActionSheet";

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
  const { theme } = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation<any>();
  const contentBottomInset = useTabContentBottomInset();

  // Data Hook
  const {
    portfolioBalance,
    portfolioLoading,
    tokens,
    filteredTokens,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    activeChain,
    setActiveChain,
    handleRefresh,
    clearError,
  } = useDashboardData();

  // Account Management Hook
  const {
    deployingAccount,
    fundingAccount,
    accountActionStatus,
    accountModalVisible,
    setAccountModalVisible,
    handleDeploySmartAccount,
    smartAccountAddress,
    smartAccountDeployed,
  } = useAccountManagement();

  // Local state for UI
  const [selectedToken, setSelectedToken] = React.useState<any>(null);
  const [activeAction, setActiveAction] = React.useState<any>(null);
  const refreshRotation = React.useRef(new Animated.Value(0)).current;

  // Formatters
  const formatPrice = useCallback((value: number) => {
    if (!Number.isFinite(value)) return "$0.00";
    return `$${value.toLocaleString("en-US", { 
      maximumFractionDigits: value >= 1 ? 2 : 6 
    })}`;
  }, []);

  const formatChange = useCallback((value: number | null) => {
    if (value === null) return "—";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }, []);

  const handleCopyAddress = useCallback(() => {
    if (smartAccountAddress) {
      Clipboard.setString(smartAccountAddress);
      Alert.alert("Copied!", "Address copied to clipboard");
    }
  }, [smartAccountAddress]);

  const spin = refreshRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <TabScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: contentBottomInset + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header & Account Selector */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Hello, Explorer</Text>
            <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>Welcome Back</Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.navigate("Notifications")}
            style={[styles.iconButton, { backgroundColor: withAlpha(colors.surfaceCard, 0.5), borderColor: colors.borderMuted }]}
          >
            <Feather name="bell" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.accountSelectorRow}>
          {smartAccountAddress ? (
            <TouchableOpacity
              style={[styles.accountButton, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}
              onPress={() => setAccountModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.accountIcon, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                <Feather name="credit-card" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.accountLabel, { color: colors.textSecondary }]}>Smart Account</Text>
                <Text style={[styles.accountAddress, { color: colors.textPrimary }]}>
                  {smartAccountAddress.slice(0, 6)}...{smartAccountAddress.slice(-4)}
                </Text>
              </View>
              <Feather name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.deployButton, { backgroundColor: withAlpha(colors.warning, 0.1), borderColor: withAlpha(colors.warning, 0.3) }]}
              onPress={() => setAccountModalVisible(true)}
            >
              <Feather name="alert-triangle" size={18} color={colors.warning} />
              <Text style={[styles.deployText, { color: colors.warning }]}>Deploy Smart Account</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.copyButton, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}
            onPress={handleCopyAddress}
          >
            <Feather name="copy" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Dashboard Content */}
        <BalanceCard
          balance={portfolioBalance}
          loading={portfolioLoading}
          address={smartAccountAddress}
        />

        <ActionGrid onActionPress={(action) => setActiveAction(action)} />

        <AssetList
          assets={tokens.slice(0, 5).map(t => ({
            symbol: t.symbol,
            name: t.name,
            amount: 0,
            price: t.priceUsd || 0,
            value: 0,
            change24h: t.change24h || 0,
            address: t.address
          }))}
          predictedAddress={smartAccountAddress}
          formatPrice={formatPrice}
        />

        <ActivityFeed />

        <MarketSection
          tokens={tokens}
          filteredTokens={filteredTokens}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeChain={activeChain}
          activeChainLabel={activeChain}
          onSelectChain={setActiveChain}
          onRefresh={handleRefresh}
          onRetry={handleRefresh}
          onTokenPress={setSelectedToken}
          isRefreshing={loading}
          refreshSpin={{ transform: [{ rotate: spin }] }}
          renderTokenItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.marketItem, { borderBottomColor: colors.borderMuted }]}
              onPress={() => setSelectedToken(item)}
            >
              <View style={styles.tokenInfo}>
                <View style={[styles.tokenLogo, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                  <Text style={[styles.tokenSymbol, { color: colors.accent }]}>{item.symbol.slice(0, 1)}</Text>
                </View>
                <View>
                  <Text style={[styles.tokenName, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.tokenSub, { color: colors.textSecondary }]}>{item.symbol.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.tokenPrice}>
                <Text style={[styles.priceText, { color: colors.textPrimary }]}>{formatPrice(item.priceUsd)}</Text>
                <Text style={[styles.changeText, { color: (item.change24h || 0) >= 0 ? colors.success : colors.danger }]}>
                  {formatChange(item.change24h)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          renderEmptyComponent={() => (
            <View style={styles.emptyMarket}>
              <Text style={{ color: colors.textSecondary }}>No market data found</Text>
            </View>
          )}
          source="Trezo Sync"
          lastUpdated={new Date().toISOString()}
        />
      </ScrollView>

      {/* Account Management Modal */}
      <Modal visible={accountModalVisible} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setAccountModalVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surfaceCard }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Manage Account</Text>
              <TouchableOpacity onPress={() => setAccountModalVisible(false)}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {!smartAccountDeployed ? (
                <View style={[styles.infoBox, { backgroundColor: withAlpha(colors.warning, 0.1) }]}>
                  <Text style={[styles.infoText, { color: colors.warning }]}>
                    Your smart account is not yet deployed on-chain. Deploy it to unlock full features.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                    onPress={handleDeploySmartAccount}
                    disabled={deployingAccount}
                  >
                    {deployingAccount ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Deploy Now</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.infoBox, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                  <Feather name="check-circle" size={24} color={colors.success} />
                  <Text style={[styles.infoText, { color: colors.success }]}>Account is deployed and active.</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      <TokenDetailSheet
        visible={Boolean(selectedToken)}
        token={selectedToken}
        onClose={() => setSelectedToken(null)}
        formatPrice={formatPrice}
        formatChange={formatChange}
      />

      <QuickActionSheet
        visible={Boolean(activeAction)}
        action={activeAction}
        onDismiss={() => setActiveAction(null)}
      />
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  accountSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  accountButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  accountAddress: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  deployButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  deployText: {
    fontSize: 14,
    fontWeight: '700',
  },
  copyButton: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenSymbol: {
    fontSize: 18,
    fontWeight: '800',
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '700',
  },
  tokenSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  tokenPrice: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyMarket: {
    padding: 40,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalContent: {
    gap: 16,
  },
  infoBox: {
    padding: 20,
    borderRadius: 20,
    gap: 16,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  }
});

export default HomeScreen;
