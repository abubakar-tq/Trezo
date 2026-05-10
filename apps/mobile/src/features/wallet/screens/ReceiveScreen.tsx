import { Feather, Ionicons } from "@expo/vector-icons";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useWalletData } from "@hooks/useWalletData";
import { useNavigation } from "@react-navigation/native";
import { TokenIcon } from "@shared/components";
import { FontFamilies } from "@shared/components/TokenRegistry";
import { AccountPickerModal } from "@shared/components/modals/AccountPickerModal";
import { AssetPickerModal, type Asset } from "@shared/components/modals/AssetPickerModal";
import { NetworkPickerModal, type Network } from "@shared/components/modals/NetworkPickerModal";
import { getEnabledChains } from "@/src/integration/chains";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ReceiveScreenProps {
  onCopyAddress?: (address: string) => void;
  onShare?: (address: string) => void;
  onClose?: () => void;
}

export const ReceiveScreen: React.FC<ReceiveScreenProps> = ({
  onCopyAddress,
  onShare,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const { tokens } = useWalletData();
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const { accounts, setActiveAccount, activeAccount } = useWalletStore();
  
  const walletAddress = activeAccount?.address || smartAccountAddress || "0x742d35Cc6634C0532925a3b844Bc7e7595f0Af";
  const [isAssetPickerVisible, setIsAssetPickerVisible] = useState(false);
  const [isNetworkPickerVisible, setIsNetworkPickerVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleAccountSelect = (account: any) => {
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
  
  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    symbol: 'ETH',
    name: 'Ethereum',
  });

  const defaultNetwork: Network = (() => {
    const enabled = getEnabledChains();
    const first = enabled[0];
    if (!first) {
      return { id: '31337', name: 'Anvil', chainId: 31337, color: '#4f46e5', isMainnet: false };
    }
    return {
      id: String(first.id),
      name: first.name,
      chainId: first.id,
      color: '#4f46e5',
      isMainnet: first.environment === 'mainnet',
    };
  })();

  const [selectedNetwork, setSelectedNetwork] = useState<Network>(defaultNetwork);

  const handleCopyAddress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCopyAddress?.(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onShare) {
      onShare(walletAddress);
    } else {
      try {
        await Share.share({
          message: walletAddress,
        });
      } catch (error) {
        console.log(error);
      }
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onClose) {
      onClose();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity 
          onPress={handleClose} 
          style={[styles.backButton, { backgroundColor: colors.glass }]}
        >
          <Feather name="x" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.labelKicker, { color: colors.accent }]}>SECURE PASSAGE</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Receive Funds</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        bounces={true}
      >
        <View style={styles.selectorsContainer}>
          {/* Account Selector */}
          <TouchableOpacity 
            style={[styles.selectorRow, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => setIsAccountPickerVisible(true)}
          >
             <View style={[styles.selectorIcon, { backgroundColor: `${colors.accentAlt}1A` }]}>
               <Text style={[styles.selectorIconText, { color: colors.accentAlt }]}>{activeAccount?.name[0] || 'P'}</Text>
             </View>
             <View style={styles.selectorInfo}>
               <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>RECEIVING TO ACCOUNT</Text>
               <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{activeAccount?.name || 'Primary'}</Text>
             </View>
             <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Network Selector */}
          <TouchableOpacity 
            style={[styles.selectorRow, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => setIsNetworkPickerVisible(true)}
          >
             {selectedNetwork.icon ? (
               <TokenIcon uri={selectedNetwork.icon} symbol={selectedNetwork.name[0]} size={32} />
             ) : (
               <View style={[styles.selectorIcon, { backgroundColor: `${selectedNetwork.color}1A` }]}>
                 <Text style={[styles.selectorIconText, { color: selectedNetwork.color }]}>{selectedNetwork.name[0]}</Text>
               </View>
             )}
             <View style={styles.selectorInfo}>
               <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>NETWORK</Text>
               <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedNetwork.name}</Text>
             </View>
             <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Asset Selector */}
          <TouchableOpacity 
            style={[styles.selectorRow, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
            onPress={() => setIsAssetPickerVisible(true)}
          >
             <TokenIcon symbol={selectedAsset.symbol} uri={selectedAsset.logo} size={32} />
             <View style={styles.selectorInfo}>
               <Text style={[styles.selectorLabel, { color: colors.textMuted }]}>ASSET</Text>
               <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedAsset.name} ({selectedAsset.symbol})</Text>
             </View>
             <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* QR Code Section - The "Beacon" */}
        <View style={[styles.qrCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <View style={[styles.qrContainer, { backgroundColor: '#FFF', borderColor: colors.accent }]}>
             <QRCode
                value={walletAddress}
                size={220}
                color="#000"
                backgroundColor="#FFF"
              />
          </View>
          <View style={styles.qrFooter}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} />
            <Text style={[styles.qrFooterText, { color: colors.textSecondary }]}>Verified Wallet Address</Text>
          </View>
        </View>

        {/* Address Card - Glassmorphic Display */}
        <View style={[styles.addressCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
           <View style={styles.addressHeader}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>YOUR WALLET ADDRESS</Text>
              <TouchableOpacity onPress={handleCopyAddress} style={[styles.copyBadge, { backgroundColor: `${colors.accent}14` }]}>
                <Feather name={copied ? "check" : "copy"} size={14} color={colors.accent} />
                <Text style={[styles.copyBadgeText, { color: colors.accent }]}>{copied ? "COPIED" : "COPY"}</Text>
              </TouchableOpacity>
           </View>
           <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
             {walletAddress}
           </Text>
        </View>



        {/* Informational Section */}
        <View style={styles.infoSection}>
           <View style={styles.infoRow}>
              <Feather name="zap" size={16} color={colors.accent} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Funds arrive instantly after 12 confirmations.</Text>
           </View>
           <View style={styles.infoRow}>
              <Feather name="lock" size={16} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>{"Protected by Trezo's multi-sig security layer."}</Text>
           </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          style={styles.actionButtonContainer}
          activeOpacity={0.9}
          onPress={handleShare}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentAlt]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.actionButton}
          >
            <Text style={[styles.actionButtonText, { color: colors.textOnAccent }]}>Share My Address</Text>
            <Feather name="share-2" size={20} color={colors.textOnAccent} />
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      <AccountPickerModal
        isVisible={isAccountPickerVisible}
        onClose={() => setIsAccountPickerVisible(false)}
        onSelect={handleAccountSelect}
        accounts={accounts}
        selectedAddress={walletAddress}
      />

      <AssetPickerModal
        isVisible={isAssetPickerVisible}
        onClose={() => setIsAssetPickerVisible(false)}
        onSelect={(asset) => setSelectedAsset(asset)}
        assets={tokens}
      />

      <NetworkPickerModal
        isVisible={isNetworkPickerVisible}
        onClose={() => setIsNetworkPickerVisible(false)}
        onSelect={(network) => setSelectedNetwork(network)}
        selectedNetworkId={selectedNetwork.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  labelKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  selectorsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  selectorIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorIconText: {
    fontSize: 16,
    fontWeight: '900',
  },
  selectorInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  selectorLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  selectorValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  qrCard: {
    borderRadius: 32,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  qrFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  qrFooterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addressCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  addressText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FontFamilies.mono,
    lineHeight: 16,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  networkCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  networkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  networkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkIconText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 'bold',
  },
  networkName: {
    fontSize: 15,
    fontWeight: '800',
  },
  networkDesc: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoSection: {
    gap: 12,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonContainer: {
    width: '100%',
  },
  actionButton: {
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  actionButtonText: {
    fontSize: 16,
    letterSpacing: 0.5,
  },
});

export default ReceiveScreen;
