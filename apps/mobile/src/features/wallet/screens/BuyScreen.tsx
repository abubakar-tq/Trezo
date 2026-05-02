/**
 * BuyScreen.tsx
 * 
 * Minimalistic Buy Crypto Screen
 * Single-screen layout, no scrolling
 * Clean, sophisticated design matching home tab aesthetic
 */

import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useWalletData } from "@hooks/useWalletData";
import { AccountPickerModal } from "@shared/components/modals/AccountPickerModal";
import { AssetPickerModal, type Asset } from "@shared/components/modals/AssetPickerModal";
import { useWalletStore } from "../store/useWalletStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const BuyScreen: React.FC = () => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isDark = resolvedMode === 'dark';

  const { tokens } = useWalletData();
  const { accounts, activeAccountId, setActiveAccount } = useWalletStore();
  
  const [amount, setAmount] = useState("");
  const [isAssetPickerVisible, setIsAssetPickerVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = useState(false);
  
  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];

  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    symbol: 'ETH',
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  });

  // Calculate crypto amount
  const estimatedCrypto = useMemo(() => {
    const val = parseFloat(amount || "0");
    if (isNaN(val) || val <= 0) return "0.0000";
    
    const basePrice = selectedAsset.symbol === 'ETH' ? 2500 : 
                      selectedAsset.symbol === 'BTC' ? 45000 : 
                      selectedAsset.symbol === 'USDC' ? 1 : 100;
    
    return (val / basePrice).toFixed(4);
  }, [amount, selectedAsset]);

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReviewPurchase = async () => {
    const val = parseFloat(amount || "0");
    if (val <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const banxaUrl = `https://checkout.banxa.com/?fiatAmount=${amount}&fiatCode=USD&coinCode=${selectedAsset.symbol}&walletAddress=${activeAccount?.address || ''}`;
    
    await WebBrowser.openBrowserAsync(banxaUrl);
  };

  const handleAccountSelect = (account: any) => {
    setActiveAccount(account);
    setIsAccountPickerVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const displayAddress = activeAccount?.address 
    ? `${activeAccount.address.slice(0, 6)}...${activeAccount.address.slice(-4)}`
    : 'No wallet';

  const isValidAmount = amount && parseFloat(amount) > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Minimal Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }} 
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Buy
          </Text>
          
          <TouchableOpacity 
            onPress={() => setIsAccountPickerVisible(true)}
            style={styles.walletChip}
          >
            <View style={[styles.walletDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.walletChipText, { color: colors.textSecondary }]}>
              {activeAccount?.name || 'Primary Wallet'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Main Content - No Scroll, Single Screen */}
        <View style={styles.content}>
          
          {/* Token Selector Card - Compact */}
          <TouchableOpacity 
            style={[styles.tokenCard, { backgroundColor: colors.surfaceCard }]}
            onPress={() => setIsAssetPickerVisible(true)}
            activeOpacity={0.9}
          >
            <View style={styles.tokenLeft}>
              {selectedAsset.logo ? (
                <Image 
                  source={{ uri: selectedAsset.logo }} 
                  style={styles.tokenIcon}
                />
              ) : (
                <View style={[styles.tokenAvatar, { backgroundColor: withAlpha(colors.accent, 0.12) }]}>
                  <Text style={[styles.tokenAvatarText, { color: colors.accent }]}>
                    {selectedAsset.symbol[0]}
                  </Text>
                </View>
              )}
              <View style={styles.tokenDetails}>
                <Text style={[styles.tokenSymbol, { color: colors.textPrimary }]}>
                  {selectedAsset.symbol}
                </Text>
                <Text style={[styles.tokenName, { color: colors.textMuted }]}>
                  {selectedAsset.name}
                </Text>
              </View>
            </View>
            <Feather name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Amount Input Section */}
          <View style={[styles.amountCard, { backgroundColor: colors.surfaceCard }]}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
              Enter amount in USD
            </Text>
            <View style={styles.amountInputRow}>
              <Text style={[styles.dollarSign, { color: colors.textPrimary }]}>$</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.textPrimary }]}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={withAlpha(colors.textPrimary, 0.15)}
                maxLength={7}
                selectionColor={colors.accent}
                autoFocus
              />
            </View>
            
            {/* Conversion Display */}
            <View style={[styles.conversionRow, { borderTopColor: withAlpha(colors.border, 0.08) }]}>
              <View style={styles.conversionLeft}>
                <Feather name="arrow-down" size={14} color={colors.accent} />
                <Text style={[styles.conversionText, { color: colors.textSecondary }]}>
                  You get
                </Text>
              </View>
              <Text style={[styles.conversionAmount, { color: colors.textPrimary }]}>
                {estimatedCrypto} {selectedAsset.symbol}
              </Text>
            </View>
          </View>

          {/* Banxa Info - Subtle text style */}
          <View style={styles.banxaInfo}>
            <View style={styles.banxaLeft}>
              <FontAwesome5 name="bolt" size={12} color={colors.accent} />
              <Text style={[styles.banxaTitle, { color: colors.textPrimary }]}>
                Banxa
              </Text>
            </View>
            <Text style={[styles.banxaSubtitle, { color: colors.textMuted }]}>
              2% fee • 5-10 min
            </Text>
          </View>

          {/* Spacer to push button down */}
          <View style={styles.spacer} />
        </View>

        {/* Fixed Bottom Action */}
        <View style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity 
            activeOpacity={0.9}
            onPress={handleReviewPurchase}
            disabled={!isValidAmount}
          >
            <LinearGradient
              colors={isValidAmount ? [colors.accent, colors.accent] : ['#ccc', '#bbb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.actionButton, { opacity: isValidAmount ? 1 : 0.5 }]}
            >
              <Text style={styles.actionText}>
                {isValidAmount ? `Buy ${estimatedCrypto} ${selectedAsset.symbol}` : 'Enter Amount'}
              </Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={[styles.termsText, { color: colors.textMuted }]}>
            Powered by Banxa • Prices include fees
          </Text>
        </View>

      </KeyboardAvoidingView>

      {/* Modals */}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  walletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  walletChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  tokenAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  tokenDetails: {
    gap: 2,
  },
  tokenSymbol: {
    fontSize: 17,
    fontWeight: '700',
  },
  tokenName: {
    fontSize: 13,
    fontWeight: '500',
  },
  amountCard: {
    padding: 20,
    borderRadius: 20,
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dollarSign: {
    fontSize: 32,
    fontWeight: '600',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.5,
    padding: 0,
    margin: 0,
  },
  conversionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  conversionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conversionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  conversionAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  banxaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  banxaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  banxaTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  banxaSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  actionButton: {
    height: 60,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  actionText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  termsText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default BuyScreen;
