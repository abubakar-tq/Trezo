import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import TabScreenContainer from "@shared/components/TabScreenContainer";
import { MeshBackground } from "@shared/components/MeshBackground";
import { 
  BalanceCard, 
  ActionGrid, 
  ActivityFeed,
} from "../components/dashboard";
import { MarketExplorer } from "../components/dashboard/MarketExplorer";
import { SecurityStatus } from "../components/dashboard/SecurityStatus";
import { TokenDetailModal } from "../../portfolio/components/TokenDetailModal";
import type { TokenBalance } from "../../portfolio/services/PortfolioService";
import { useWalletData } from "@hooks/useWalletData";
import { useUserStore } from "@store/useUserStore";
import { withAlpha } from "@utils/color";

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
  
  const { totalBalanceUSD, tokens, isLoading: walletLoading } = useWalletData(smartAccountAddress ?? undefined);

  const [selectedToken, setSelectedToken] = React.useState<TokenBalance | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const marketRef = React.useRef<any>(null);

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
      amount: parseFloat(t.balance_formatted || "0"),
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

  return (
    <TabScreenContainer includeBottomInset>
      <MeshBackground />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.brandName, { color: colors.textPrimary }]}>TREZO</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={() => marketRef.current?.focusSearch()} 
              style={[styles.headerAction, { backgroundColor: colors.glass, marginRight: 8 }]}
            >
              <Feather name="search" size={18} color={colors.textPrimary} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => navigation.navigate("Notifications")}
              style={[styles.headerAction, { backgroundColor: colors.glass }]}
            >
              <Feather name="bell" size={18} color={colors.textPrimary} strokeWidth={1.5} />
              <View style={[styles.notiDot, { backgroundColor: colors.accentAlt }]} />
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
            onDeploy={() => navigation.navigate("DeployAccount")}
          />
        </View>

        <View style={styles.sectionWrapper}>
          <View style={[styles.glassSection, styles.glassSectionAction, { backgroundColor: theme.mode === 'dark' ? 'rgba(25, 25, 25, 0.65)' : '#FFFFFF', borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 12 }]}>Quick Actions</Text>
            <ActionGrid onActionPress={(action) => navigation.navigate("Action", { action: action.key })} />
          </View>
        </View>


        {/* Market Trends - Unified Header */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.glassSection, { backgroundColor: theme.mode === 'dark' ? 'rgba(25, 25, 25, 0.65)' : '#FFFFFF', borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 12 }]}>Market Trends</Text>
            <MarketExplorer ref={marketRef} />
          </View>
        </View>


        <View style={styles.sectionWrapper}>
          <View style={[styles.glassSection, { backgroundColor: theme.mode === 'dark' ? 'rgba(25, 25, 25, 0.65)' : '#FFFFFF', borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent Activity</Text>
            <ActivityFeed limit={3} />
          </View>
        </View>

        <View style={styles.sectionWrapper}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginLeft: 4, marginBottom: 12 }]}>Security Status</Text>
          <SecurityStatus />
        </View>
      </ScrollView>

      {selectedToken && (
        <TokenDetailModal 
          visible={modalVisible} 
          onClose={() => setModalVisible(false)} 
          token={selectedToken} 
        />
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 36,
    marginBottom: 16,
  },
  brandName: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 2.5,
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
  },
  notiDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#050505',
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
});

export default HomeScreen;
