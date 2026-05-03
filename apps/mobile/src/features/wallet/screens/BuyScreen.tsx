/**
 * BuyScreen.tsx
 * 
 * Refactored Buy Crypto Screen
 * - Supports Provider Abstraction (Transak/Mock)
 * - Real-time status polling
 * - Local Anvil fulfillment support
 */

import { Feather, FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useWalletData } from "@hooks/useWalletData";
import { AccountPickerModal } from "@shared/components/modals/AccountPickerModal";
import { AssetPickerModal, type Asset } from "@shared/components/modals/AssetPickerModal";
import { useWalletStore } from "../store/useWalletStore";
import { RampService } from "../../../services/RampService";
import { RampOrder, RampStatus } from "../../../types/ramp";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const BuyScreen: React.FC = () => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const isDark = resolvedMode === 'dark';

  const { tokens } = useWalletData();
  const { accounts, activeAccountId, setActiveAccount } = useWalletStore();
  
  // Input State
  const [amount, setAmount] = useState("");
  const [isAssetPickerVisible, setIsAssetPickerVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = useState(false);
  
  // Order State
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeOrder, setActiveOrder] = useState<RampOrder | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];

  const [selectedAsset, setSelectedAsset] = useState<Asset>({
    symbol: 'ETH',
    name: 'Ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  });

  // Calculate crypto amount (Rough estimate for UI)
  const estimatedCrypto = useMemo(() => {
    const val = parseFloat(amount || "0");
    if (isNaN(val) || val <= 0) return "0.0000";
    const basePrice = selectedAsset.symbol === 'ETH' ? 2500 : 
                      selectedAsset.symbol === 'BTC' ? 65000 : 
                      selectedAsset.symbol === 'USDC' ? 1 : 100;
    return (val / basePrice).toFixed(4);
  }, [amount, selectedAsset]);

  // Polling Logic
  useEffect(() => {
    if (isPolling && activeOrder?.id) {
      pollInterval.current = setInterval(async () => {
        try {
          const updatedOrder = await RampService.getOrder(activeOrder.id);
          setActiveOrder(updatedOrder);
          
          if (['completed', 'failed', 'local_mock_completed', 'expired'].includes(updatedOrder.internalStatus)) {
            stopPolling();
            if (updatedOrder.internalStatus === 'local_mock_completed' || updatedOrder.internalStatus === 'completed') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 3000);
    }
    return () => stopPolling();
  }, [isPolling, activeOrder?.id]);

  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    setIsPolling(false);
  };

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBuy = async () => {
    const val = parseFloat(amount || "0");
    if (val <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const session = await RampService.createSession({
        walletAddress: activeAccount.address,
        chainId: 31337, // Local Anvil for Demo
        fiatCurrency: 'USD',
        fiatAmount: val,
        cryptoCurrency: selectedAsset.symbol,
      });

      // Get initial order data
      const order = await RampService.getOrder(session.orderId);
      setActiveOrder(order);
      setIsPolling(true);

      if (session.provider === 'transak' && session.widgetUrl) {
        await WebBrowser.openBrowserAsync(session.widgetUrl);
      } else if (session.provider === 'mock') {
        // Mock provider just shows the status card immediately
      }

    } catch (error: any) {
      console.error("Buy error:", error);
      Alert.alert("Error", error.message || "Failed to create session");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteMock = async () => {
    if (!activeOrder) return;
    
    try {
      setIsProcessing(true);
      await RampService.completeMockOrder(activeOrder.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to complete mock order");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetOrder = () => {
    setActiveOrder(null);
    setAmount("");
    stopPolling();
  };

  const getStatusColor = (status: RampStatus) => {
    switch (status) {
      case 'completed':
      case 'local_mock_completed': return colors.success;
      case 'failed':
      case 'expired': return colors.error;
      case 'processing': return colors.accent;
      default: return colors.textSecondary;
    }
  };

  const getStatusText = (status: RampStatus) => {
    switch (status) {
      case 'created': return 'Order Initiated';
      case 'widget_opened': return 'Awaiting Payment';
      case 'payment_pending': return 'Confirming Payment';
      case 'processing': return 'Funding Wallet...';
      case 'completed': return 'Funds Delivered';
      case 'local_mock_completed': return 'Mock Funding Successful';
      case 'failed': return 'Transaction Failed';
      default: return status.toUpperCase();
    }
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
          >
            <Feather name="chevron-left" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Buy Crypto
          </Text>
          
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {!activeOrder ? (
            <>
              {/* Wallet Selector */}
              <TouchableOpacity 
                onPress={() => setIsAccountPickerVisible(true)}
                style={[styles.accountCard, { backgroundColor: colors.surfaceCard }]}
              >
                <View style={styles.accountInfo}>
                  <View style={[styles.accountDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.accountName, { color: colors.textPrimary }]}>
                    {activeAccount?.name || 'Primary Account'}
                  </Text>
                </View>
                <Text style={[styles.accountAddress, { color: colors.textMuted }]}>
                  {displayAddress}
                </Text>
              </TouchableOpacity>

              {/* Amount Entry Area */}
              <View style={styles.entrySection}>
                <View style={styles.amountInputRow}>
                  <Text style={[styles.currencySymbol, { color: colors.textPrimary }]}>$</Text>
                  <TextInput
                    style={[styles.amountInput, { color: colors.textPrimary }]}
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={withAlpha(colors.textPrimary, 0.1)}
                    maxLength={7}
                    autoFocus
                  />
                </View>
                
                <Text style={[styles.estimatedCrypto, { color: colors.textMuted }]}>
                  ≈ {estimatedCrypto} {selectedAsset.symbol}
                </Text>

                {/* Asset Selector Chip */}
                <TouchableOpacity 
                  style={[styles.assetChip, { backgroundColor: withAlpha(colors.accent, 0.1) }]}
                  onPress={() => setIsAssetPickerVisible(true)}
                >
                  <Image source={{ uri: selectedAsset.logo }} style={styles.assetLogo} />
                  <Text style={[styles.assetChipText, { color: colors.accent }]}>{selectedAsset.symbol}</Text>
                  <Feather name="chevron-down" size={14} color={colors.accent} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* ACTIVE ORDER STATUS CARD */
            <View style={[styles.statusContainer, { backgroundColor: colors.surfaceCard }]}>
              <View style={[styles.statusIconContainer, { backgroundColor: withAlpha(getStatusColor(activeOrder.internalStatus), 0.1) }]}>
                {['completed', 'local_mock_completed'].includes(activeOrder.internalStatus) ? (
                  <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                ) : activeOrder.internalStatus === 'failed' ? (
                  <Ionicons name="close-circle" size={64} color={colors.error} />
                ) : (
                  <ActivityIndicator size="large" color={colors.accent} />
                )}
              </View>

              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
                {getStatusText(activeOrder.internalStatus)}
              </Text>
              
              <Text style={[styles.statusSubtitle, { color: colors.textMuted }]}>
                {activeOrder.fiatAmount} {activeOrder.fiatCurrency} → {estimatedCrypto} {activeOrder.cryptoCurrency}
              </Text>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.detailsList}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Provider</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary, textTransform: 'capitalize' }]}>
                    {activeOrder.provider}
                  </Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Destination</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{displayAddress}</Text>
                </View>

                {(activeOrder.txHash || activeOrder.localFulfillmentTxHash) && (
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Transaction</Text>
                    <Text style={[styles.detailValue, { color: colors.accent }]} numberOfLines={1}>
                      {(activeOrder.txHash || activeOrder.localFulfillmentTxHash)?.slice(0, 10)}...{(activeOrder.txHash || activeOrder.localFulfillmentTxHash)?.slice(-8)}
                    </Text>
                  </View>
                )}
              </View>

              {/* DEV TOOLS: Complete Mock Order */}
              {activeOrder.provider === 'mock' && !['local_mock_completed', 'completed', 'failed'].includes(activeOrder.internalStatus) && (
                <TouchableOpacity 
                  style={[styles.mockButton, { backgroundColor: colors.accent }]}
                  onPress={handleCompleteMock}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <FontAwesome5 name="magic" size={16} color="#fff" />
                      <Text style={styles.mockButtonText}>Complete Mock Order</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {['completed', 'local_mock_completed', 'failed'].includes(activeOrder.internalStatus) && (
                <TouchableOpacity 
                  style={[styles.doneButton, { borderColor: colors.border }]}
                  onPress={resetOrder}
                >
                  <Text style={[styles.doneButtonText, { color: colors.textPrimary }]}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer Action Button */}
        {!activeOrder && (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity 
              activeOpacity={0.9}
              onPress={handleBuy}
              disabled={!isValidAmount || isProcessing}
            >
              <LinearGradient
                colors={isValidAmount ? [colors.accent, colors.accent] : [colors.border, colors.border]}
                style={[styles.buyButton, { opacity: isValidAmount ? 1 : 0.5 }]}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buyButtonText}>Buy {selectedAsset.symbol}</Text>
                    <Feather name="arrow-right" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <Text style={[styles.poweredBy, { color: colors.textMuted }]}>
              Powered by Trezo Multi-Ramp Engine
            </Text>
          </View>
        )}

      </KeyboardAvoidingView>

      {/* Modals */}
      <AccountPickerModal
        isVisible={isAccountPickerVisible}
        onClose={() => setIsAccountPickerVisible(false)}
        onSelect={(acc) => { setActiveAccount(acc); setIsAccountPickerVisible(false); }}
        accounts={accounts}
        selectedAddress={activeAccount?.address}
      />

      <AssetPickerModal
        isVisible={isAssetPickerVisible}
        onClose={() => setIsAssetPickerVisible(false)}
        onSelect={(asset) => { setSelectedAsset(asset); setIsAssetPickerVisible(false); }}
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
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    marginBottom: 40,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
  },
  accountAddress: {
    fontSize: 13,
    fontWeight: '500',
  },
  entrySection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '500',
    marginTop: 8,
  },
  amountInput: {
    fontSize: 64,
    fontWeight: '700',
    textAlign: 'center',
  },
  estimatedCrypto: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  assetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 24,
  },
  assetLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  assetChipText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  buyButton: {
    height: 64,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buyButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  poweredBy: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 12,
    fontWeight: '500',
  },
  statusContainer: {
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  statusIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 24,
  },
  divider: {
    width: '100%',
    height: 1,
    marginBottom: 24,
    opacity: 0.1,
  },
  detailsList: {
    width: '100%',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  mockButton: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 32,
  },
  mockButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneButton: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default BuyScreen;
