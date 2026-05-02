/**
 * SendScreen.tsx
 * 
 * Majestic Web3 Send screen.
 * Part of the "Celestial Cartographer" Design System.
 */

import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MeshBackground, TokenIcon } from "@shared/components";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface SendScreenProps {
  onReviewSend?: (recipient: string, amount: string) => void;
  onCancel?: () => void;
}

import { AssetPickerModal, type Asset } from "@shared/components/modals/AssetPickerModal";
import { AccountPickerModal, type Account } from "@shared/components/modals/AccountPickerModal";
import { NetworkPickerModal, type Network } from "@shared/components/modals/NetworkPickerModal";
import { useWalletData } from "@hooks/useWalletData";
import { useWalletStore } from "../store/useWalletStore";

export const SendScreen: React.FC<SendScreenProps> = ({
  onReviewSend,
  onCancel,
}) => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isDark = resolvedMode === 'dark';

  const { tokens } = useWalletData();
  const { accounts, activeAccountId, setActiveAccount } = useWalletStore();
  
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [isAssetPickerVisible, setIsAssetPickerVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = useState(false);
  const [isNetworkPickerVisible, setIsNetworkPickerVisible] = useState(false);
  
  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];

  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    symbol: 'ETH',
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    balance: '1.25',
    usd_value: 3125
  });

  const [selectedNetwork, setSelectedNetwork] = useState<Network>({
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    color: '#627EEA',
    icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
  });

  const walletBalance = parseFloat(selectedAsset.balance || "0");
  const gasEstimate = 0.00042;
  const assetPrice = (selectedAsset.usd_value || 0) / (parseFloat(selectedAsset.balance || "1") || 1);

  const handleReview = () => {
    if (!recipient || !amount) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsReviewing(true);
    setTimeout(() => {
      onReviewSend?.(recipient, amount);
      setIsReviewing(false);
    }, 800);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onCancel) {
      onCancel();
    } else {
      navigation.goBack();
    }
  };

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <MeshBackground intensity={0.4} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity 
            onPress={handleCancel} 
            style={[styles.backButton, { backgroundColor: withAlpha(colors.textPrimary, 0.05) }]}
          >
            <Feather name="x" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.labelKicker, { color: withAlpha(colors.accent, 0.8) }]}>TRANSMIT VALUE</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Send Assets</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          bounces={true}
        >
          {/* Selectors - Vertical Layout */}
          <View style={styles.selectorsContainer}>
            <TouchableOpacity 
              style={[styles.selectorRow, { backgroundColor: withAlpha(colors.surfaceCard, 0.4), borderColor: withAlpha(colors.border, 0.1) }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAccountPickerVisible(true);
              }}
            >
               <View style={[styles.selectorIcon, { backgroundColor: withAlpha(colors.accentAlt, 0.1) }]}>
                 <Text style={[styles.selectorIconText, { color: colors.accentAlt }]}>{activeAccount?.name[0] || 'P'}</Text>
               </View>
               <View style={styles.selectorInfo}>
                 <Text style={[styles.selectorLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>SENDING FROM</Text>
                 <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{activeAccount?.name || 'Primary'}</Text>
               </View>
               <Feather name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>

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
                 <Text style={[styles.selectorLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>ON NETWORK</Text>
                 <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedNetwork.name}</Text>
               </View>
               <Feather name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Balance Preview - Floating Aesthetic */}
          <View style={styles.balancePreview}>
             <Text style={[styles.balancePreviewLabel, { color: colors.textMuted }]}>Available Balance</Text>
             <Text style={[styles.balancePreviewValue, { color: colors.textPrimary }]}>{walletBalance} {selectedAsset.symbol}</Text>
          </View>

          {/* Destination & Amount Card */}
          <View style={[styles.transactionCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.4), borderColor: withAlpha(colors.border, 0.1) }]}>
            {/* Recipient Section */}
            <View style={styles.inputSection}>
              <View style={styles.inputHeader}>
                <Text style={[styles.inputLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>RECIPIENT</Text>
                <TouchableOpacity style={styles.scanButton}>
                  <Ionicons name="scan-outline" size={16} color={colors.accent} />
                  <Text style={[styles.scanButtonText, { color: colors.accent }]}>SCAN</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.recipientRow}>
                <TextInput
                  style={[styles.recipientInput, { color: colors.textPrimary }]}
                  placeholder="Address or ENS"
                  placeholderTextColor={withAlpha(colors.textPrimary, 0.2)}
                  value={recipient}
                  onChangeText={setRecipient}
                  multiline={false}
                />
                <TouchableOpacity style={[styles.contactButton, { backgroundColor: withAlpha(colors.textSecondary, 0.05) }]}>
                  <Feather name="user" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: withAlpha(colors.border, 0.05) }]} />

            {/* Amount Section */}
            <View style={styles.inputSection}>
              <View style={styles.inputHeader}>
                <Text style={[styles.inputLabel, { color: withAlpha(colors.textSecondary, 0.5) }]}>AMOUNT</Text>
                <TouchableOpacity onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAmount(walletBalance.toString());
                }}>
                  <Text style={[styles.maxButton, { color: colors.accent }]}>SEND MAX</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.amountRow}>
                <TouchableOpacity 
                  style={[styles.assetSelector, { backgroundColor: withAlpha(colors.textSecondary, 0.05) }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAssetPickerVisible(true);
                  }}
                >
                  <View style={[styles.miniAssetIcon, { backgroundColor: colors.accent }]}>
                    <Text style={styles.miniAssetIconText}>{selectedAsset.symbol[0]}</Text>
                  </View>
                  <Text style={[styles.assetSymbolText, { color: colors.textPrimary }]}>{selectedAsset.symbol}</Text>
                  <Feather name="chevron-down" size={14} color={colors.textMuted} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.amountInput, { color: colors.textPrimary }]}
                  placeholder="0.00"
                  placeholderTextColor={withAlpha(colors.textPrimary, 0.1)}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.amountFooter}>
                 <Text style={[styles.amountFiat, { color: colors.textMuted }]}>
                   ≈ ${(parseFloat(amount || "0") * assetPrice).toFixed(2)} USD
                 </Text>
              </View>
            </View>
          </View>



          {/* Fee & Stats Section */}
          <View style={[styles.statsCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.2), borderColor: withAlpha(colors.border, 0.05) }]}>
             <View style={styles.statRow}>
                <View style={styles.statLabelGroup}>
                   <MaterialCommunityIcons name="gas-station" size={14} color={colors.textSecondary} />
                   <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Network Fee</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>${(gasEstimate * assetPrice).toFixed(2)}</Text>
             </View>
             <View style={styles.statRow}>
                <View style={styles.statLabelGroup}>
                   <Feather name="clock" size={14} color={colors.textSecondary} />
                   <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Estimated Time</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>~30 seconds</Text>
             </View>
          </View>

          {/* Security Banner */}
          <View style={[styles.securityBanner, { backgroundColor: withAlpha(colors.success, 0.05), borderColor: withAlpha(colors.success, 0.1) }]}>
             <Ionicons name="shield-checkmark" size={14} color={colors.success} />
             <Text style={[styles.securityText, { color: colors.success }]}>End-to-End Encrypted Transmission</Text>
          </View>

          {/* Action Button */}
          <TouchableOpacity 
            style={styles.actionButtonContainer}
            activeOpacity={0.9}
            onPress={handleReview}
            disabled={!recipient || !amount || isReviewing}
          >
            <LinearGradient
              colors={(!recipient || !amount) ? [withAlpha(colors.accent, 0.3), withAlpha(colors.accent, 0.15)] : [colors.accent, '#85c3c3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionButton}
            >
              <Text style={[styles.actionButtonText, { color: colors.textOnAccent, opacity: (!recipient || !amount) ? 0.5 : 1 }]}>
                {isReviewing ? "Preparing Nexus..." : "Review Transmission"}
              </Text>
              {!isReviewing && <Feather name="send" size={18} color={colors.textOnAccent} style={{ opacity: (!recipient || !amount) ? 0.5 : 1 }} />}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>

        <AccountPickerModal
          isVisible={isAccountPickerVisible}
          onClose={() => setIsAccountPickerVisible(false)}
          onSelect={handleAccountSelect}
          accounts={accounts}
          selectedAddress={activeAccount?.address}
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
        />

      </KeyboardAvoidingView>
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
  balancePreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  balancePreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  balancePreviewValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  transactionCard: {
    borderRadius: 32,
    borderWidth: 1,
    padding: 24,
    marginBottom: 20,
  },
  inputSection: {
    gap: 12,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scanButtonText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recipientInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    padding: 0,
  },
  contactButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDivider: {
    height: 1,
    marginVertical: 24,
  },
  maxButton: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  assetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  miniAssetIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAssetIconText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  assetSymbolText: {
    fontSize: 14,
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '900',
    padding: 0,
    textAlign: 'right',
  },
  amountFooter: {
    alignItems: 'flex-end',
  },
  amountFiat: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 32,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default SendScreen;
