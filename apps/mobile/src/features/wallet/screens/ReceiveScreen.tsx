/**
 * ReceiveScreen.tsx
 * 
 * Majestic Web3 Receive screen.
 * Part of the "Celestial Cartographer" Design System.
 */

import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { TokenIcon } from "@shared/components";
import { MeshBackground } from "@shared/components/MeshBackground";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
    Dimensions,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ReceiveScreenProps {
  onCopyAddress?: (address: string) => void;
  onShare?: (address: string) => void;
  onClose?: () => void;
}

import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useWalletData } from "@hooks/useWalletData";
import { AccountPickerModal } from "@shared/components/modals/AccountPickerModal";
import { AssetPickerModal, type Asset } from "@shared/components/modals/AssetPickerModal";
import { NetworkPickerModal, type Network } from "@shared/components/modals/NetworkPickerModal";
import { useUserStore } from "@store/useUserStore";

export const ReceiveScreen: React.FC<ReceiveScreenProps> = ({
  onCopyAddress,
  onShare,
  onClose,
}) => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isDark = resolvedMode === 'dark';

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

  const [selectedNetwork, setSelectedNetwork] = useState<Network>({
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    color: '#627EEA',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
  });

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
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <MeshBackground intensity={0.4} />
      
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity 
          onPress={handleClose} 
          style={[styles.backButton, { backgroundColor: withAlpha(colors.textPrimary, 0.05) }]}
        >
          <Feather name="x" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.labelKicker, { color: withAlpha(colors.accent, 0.8) }]}>SECURE PASSAGE</Text>
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
            style={[styles.selectorRow, { backgroundColor: withAlpha(colors.surfaceCard, 0.4), borderColor: withAlpha(colors.border, 0.1) }]}
            onPress={() => setIsAccountPickerVisible(true)}
          >
             <View style={[styles.selectorIcon, { backgroundColor: withAlpha(colors.accentAlt, 0.1) }]}>
               <Text style={[styles.selectorIconText, { color: colors.accentAlt }]}>{activeAccount?.name[0] || 'P'}</Text>
             </View>
             <View style={styles.selectorInfo}>
               <Text style={[styles.selectorLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>RECEIVING TO ACCOUNT</Text>
               <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{activeAccount?.name || 'Primary'}</Text>
             </View>
             <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Network Selector */}
          <TouchableOpacity 
            style={[styles.selectorRow, { backgroundColor: withAlpha(colors.surfaceCard, 0.4), borderColor: withAlpha(colors.border, 0.1) }]}
            onPress={() => setIsNetworkPickerVisible(true)}
          >
             {selectedNetwork.icon ? (
               <TokenIcon uri={selectedNetwork.icon} symbol={selectedNetwork.name[0]} size={32} />
             ) : (
               <View style={[styles.selectorIcon, { backgroundColor: withAlpha(selectedNetwork.color, 0.1) }]}>
                 <Text style={[styles.selectorIconText, { color: selectedNetwork.color }]}>{selectedNetwork.name[0]}</Text>
               </View>
             )}
             <View style={styles.selectorInfo}>
               <Text style={[styles.selectorLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>NETWORK</Text>
               <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedNetwork.name}</Text>
             </View>
             <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Asset Selector */}
          <TouchableOpacity 
            style={[styles.selectorRow, { backgroundColor: withAlpha(colors.surfaceCard, 0.4), borderColor: withAlpha(colors.border, 0.1) }]}
            onPress={() => setIsAssetPickerVisible(true)}
          >
             <TokenIcon symbol={selectedAsset.symbol} uri={selectedAsset.logo} size={32} />
             <View style={styles.selectorInfo}>
               <Text style={[styles.selectorLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>ASSET</Text>
               <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedAsset.name} ({selectedAsset.symbol})</Text>
             </View>
             <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* QR Code Section - The "Beacon" */}
        <View style={[styles.qrCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.4), borderColor: withAlpha(colors.border, 0.1) }]}>
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
        <View style={[styles.addressCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.6), borderColor: withAlpha(colors.border, 0.1) }]}>
           <View style={styles.addressHeader}>
              <Text style={[styles.inputLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>YOUR WALLET ADDRESS</Text>
              <TouchableOpacity onPress={handleCopyAddress} style={styles.copyBadge}>
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
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Protected by Trezo's multi-sig security layer.</Text>
           </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          style={styles.actionButtonContainer}
          activeOpacity={0.9}
          onPress={handleShare}
        >
          <LinearGradient
            colors={[colors.accent, '#85c3c3']}
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
    shadowColor: '#00FFFF',
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
    backgroundColor: 'rgba(0,255,255,0.08)',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    color: '#FFF',
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
