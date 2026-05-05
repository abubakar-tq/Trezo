import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import * as Haptics from 'expo-haptics';
import { TabScreenContainer, MeshBackground, TokenIcon, AssetPickerModal, NetworkPickerModal, AccountPickerModal, type Asset, type Network, type Account } from '@shared/components';
import { useTabContentBottomInset, useWalletData } from '@hooks';
import { useWalletStore } from '../../wallet/store/useWalletStore';

const { width } = Dimensions.get('window');

type DexTab = 'swap' | 'bridge';

export const DexScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const route = useRoute<any>();
  const contentBottomInset = useTabContentBottomInset();
  const { tokens } = useWalletData();
  const { accounts, activeAccountId, setActiveAccount } = useWalletStore();

  const [activeTab, setActiveTab] = useState<DexTab>('swap');
  
  // Modal visibility states
  const [isAssetPickerVisible, setIsAssetPickerVisible] = useState(false);
  const [isNetworkPickerVisible, setIsNetworkPickerVisible] = useState(false);
  const [isAccountPickerVisible, setIsAccountPickerVisible] = useState(false);
  const [pickingType, setPickingType] = useState<'from' | 'to'>('from');
  
  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0];

  // Selection states
  const [fromNetwork, setFromNetwork] = useState<Network>({ id: 'ethereum', name: 'Ethereum', chainId: 1, color: '#627EEA' });
  const [toNetwork, setToNetwork] = useState<Network>({ id: 'arbitrum', name: 'Arbitrum', chainId: 42161, color: '#28A0F0' });
  
  const [fromToken, setFromToken] = useState<Asset>({ symbol: 'USDC', name: 'USD Coin' });
  const [toToken, setToToken] = useState<Asset>({ symbol: 'ETH', name: 'Ethereum' });
  
  const [recipientAddress, setRecipientAddress] = useState('0x4b0c...3796');
  
  // Handle deep linking from Home "Swap" button
  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

  const handleAssetSelect = (asset: Asset) => {
    if (pickingType === 'from') setFromToken(asset);
    else setToToken(asset);
  };

  const handleNetworkSelect = (network: Network) => {
    if (pickingType === 'from') setFromNetwork(network);
    else setToNetwork(network);
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
    <TabScreenContainer includeBottomInset>
      <MeshBackground intensity={0.8} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: contentBottomInset + 40
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Minimalist & Focused */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Exchange</Text>
        </View>

        {/* Tab Switcher - Centered Segmented Control */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surfaceCard }]}>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('swap');
            }}
            style={[styles.tab, activeTab === 'swap' && { backgroundColor: colors.accent }]}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'swap' ? colors.textOnAccent : colors.textSecondary }
            ]}>Swap</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('bridge');
            }}
            style={[styles.tab, activeTab === 'bridge' && { backgroundColor: colors.accent }]}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'bridge' ? colors.textOnAccent : colors.textSecondary }
            ]}>Bridge</Text>
          </TouchableOpacity>
        </View>

        {/* Main Swap/Bridge Interface Card */}
        {activeTab === 'swap' ? (
          <View style={[styles.mainCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            {/* Integrated Network Header */}
            <TouchableOpacity 
              style={[styles.integratedNetworkBar, { borderBottomColor: withAlpha(colors.border, 0.1) }]}
              onPress={() => {
                setPickingType('from');
                setIsNetworkPickerVisible(true);
              }}
            >
              <View style={styles.networkInfo}>
                 <View style={[styles.networkIcon, { backgroundColor: fromNetwork.color }]}>
                   <Text style={styles.networkIconText}>{fromNetwork.name[0]}</Text>
                 </View>
                 <Text style={[styles.networkName, { color: colors.textPrimary }]}>{fromNetwork.name}</Text>
              </View>
              <View style={styles.networkAction}>
                <Text style={[styles.networkActionText, { color: colors.textSecondary }]}>Switch Network</Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            {/* Pay Section */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Pay with</Text>
                <TouchableOpacity onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                  <Text style={[styles.maxButton, { color: colors.accent }]}>Max</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputRow}>
                <TouchableOpacity 
                  style={[styles.tokenSelect, { backgroundColor: withAlpha(colors.textSecondary, 0.05) }]}
                  onPress={() => {
                    setPickingType('from');
                    setIsAssetPickerVisible(true);
                  }}
                >
                  <TokenIcon symbol={fromToken.symbol} size={32} />
                  <Text style={[styles.tokenSymbol, { color: colors.textPrimary }]}>{fromToken.symbol}</Text>
                  <Feather name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <TextInput 
                  style={[styles.amountInput, { color: colors.textPrimary }]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  defaultValue="85"
                />
              </View>
              <View style={styles.inputFooter}>
                <Text style={[styles.balanceText, { color: colors.textSecondary }]}>Balance: 124.50 {fromToken.symbol}</Text>
                <Text style={[styles.fiatValue, { color: colors.textMuted }]}>$84.99</Text>
              </View>
            </View>

            {/* Swap Middle Divider */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <TouchableOpacity 
                style={[styles.swapIconButton, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const tempToken = fromToken;
                  setFromToken(toToken);
                  setToToken(tempToken);
                }}
              >
                <Ionicons name="swap-vertical" size={20} color={colors.accent} />
              </TouchableOpacity>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Receive Section */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Receive</Text>
              </View>
              <View style={styles.inputRow}>
                <TouchableOpacity 
                  style={[styles.tokenSelect, { backgroundColor: withAlpha(colors.textSecondary, 0.05) }]}
                  onPress={() => {
                    setPickingType('to');
                    setIsAssetPickerVisible(true);
                  }}
                >
                  <TokenIcon symbol={toToken.symbol} size={32} />
                  <Text style={[styles.tokenSymbol, { color: colors.textPrimary }]}>{toToken.symbol}</Text>
                  <Feather name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.amountResult, { color: colors.textPrimary }]}>0.02451</Text>
              </View>
              <View style={styles.inputFooter}>
                <Text style={[styles.balanceText, { color: colors.textMuted }]}>No balance</Text>
                <Text style={[styles.fiatValue, { color: colors.textMuted }]}>≈$83.56 (-0.69%)</Text>
              </View>
            </View>
          </View>
        ) : (
          /* "One Page" Compact Bridge Card */
          <View style={styles.bridgeContainer}>
            <View style={[styles.unifiedBridgeCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
               {/* Integrated Network Selection Integrated */}
               <View style={styles.bridgeNetworksIntegrated}>
                  <View style={styles.bridgeNetworkHalf}>
                    <Text style={[styles.bridgeMiniLabel, { color: colors.textMuted }]}>FROM</Text>
                    <TouchableOpacity 
                      style={[styles.bridgeNetworkPillIntegrated, { backgroundColor: withAlpha(colors.textSecondary, 0.03) }]}
                      onPress={() => {
                        setPickingType('from');
                        setIsNetworkPickerVisible(true);
                      }}
                    >
                      <View style={[styles.miniIcon, { backgroundColor: fromNetwork.color }]}>
                        <Text style={styles.miniIconText}>{fromNetwork.name[0]}</Text>
                      </View>
                      <Text style={[styles.bridgeNetworkNameText, { color: colors.textPrimary }]} numberOfLines={1}>{fromNetwork.name}</Text>
                      <Feather name="chevron-down" size={10} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.bridgeArrowBox}>
                    <Ionicons name="arrow-forward" size={14} color={colors.accent} />
                  </View>

                  <View style={styles.bridgeNetworkHalf}>
                    <Text style={[styles.bridgeMiniLabel, { color: colors.textMuted, textAlign: 'right' }]}>TO</Text>
                    <TouchableOpacity 
                      style={[styles.bridgeNetworkPillIntegrated, { backgroundColor: withAlpha(colors.textSecondary, 0.03) }]}
                      onPress={() => {
                        setPickingType('to');
                        setIsNetworkPickerVisible(true);
                      }}
                    >
                      <View style={[styles.miniIcon, { backgroundColor: toNetwork.color }]}>
                        <Text style={styles.miniIconText}>{toNetwork.name[0]}</Text>
                      </View>
                      <Text style={[styles.bridgeNetworkNameText, { color: colors.textPrimary }]} numberOfLines={1}>{toNetwork.name}</Text>
                      <Feather name="chevron-down" size={10} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
               </View>

               <View style={styles.bridgeInputIntegrated}>
                  <View style={styles.inputHeader}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bridge Amount</Text>
                    <TouchableOpacity onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
                      <Text style={[styles.maxButton, { color: colors.accent }]}>Use Max</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.bridgeInputRowIntegrated}>
                    <TouchableOpacity 
                      style={[styles.tokenSelectCompactIntegrated, { backgroundColor: withAlpha(colors.textSecondary, 0.05) }]}
                      onPress={() => {
                        setPickingType('from');
                        setIsAssetPickerVisible(true);
                      }}
                    >
                       <TokenIcon symbol={fromToken.symbol} size={28} />
                       <Text style={[styles.tokenSymbolText, { color: colors.textPrimary }]}>{fromToken.symbol}</Text>
                       <Feather name="chevron-down" size={12} color={colors.textMuted} />
                    </TouchableOpacity>
                    
                    <TextInput 
                      style={[styles.bridgeAmountInputIntegrated, { color: colors.textPrimary }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      defaultValue="85.00"
                    />
                  </View>
               </View>
               
               <View style={[styles.outputBannerIntegrated, { backgroundColor: withAlpha(colors.accent, 0.04), borderColor: withAlpha(colors.accent, 0.1) }]}>
                  <View style={styles.outputHeaderRow}>
                    <Text style={[styles.outputLabelText, { color: colors.textSecondary }]}>YOU RECEIVE</Text>
                    <View style={[styles.routeBadgeCompact, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                      <Ionicons name="flash" size={8} color={colors.accent} />
                      <Text style={[styles.routeLabelTextTiny, { color: colors.accent }]}>STARGATE</Text>
                    </View>
                  </View>
                  <View style={styles.outputValueRow}>
                    <Text style={[styles.outputValueLarge, { color: colors.textPrimary }]}>84.75 {fromToken.symbol}</Text>
                    <Text style={[styles.outputFiatText, { color: colors.textMuted }]}>≈ $84.72</Text>
                  </View>
               </View>
            </View>

            {/* Bridge Meta Info - Cleanly aligned */}
            <View style={styles.bridgeMetaContainer}>
              <View style={styles.metaBadgeGroup}>
                <View style={[styles.metaBadge, { backgroundColor: colors.surfaceCard }]}>
                  <Feather name="clock" size={10} color={colors.textSecondary} />
                  <Text style={[styles.metaBadgeText, { color: colors.textSecondary }]}>3m</Text>
                </View>
                <View style={[styles.metaBadge, { backgroundColor: colors.surfaceCard }]}>
                  <Feather name="activity" size={10} color={colors.textSecondary} />
                  <Text style={[styles.metaBadgeText, { color: colors.textSecondary }]}>0.5%</Text>
                </View>
              </View>
              
              <TouchableOpacity style={[styles.recipientPill, { backgroundColor: withAlpha(colors.accentAlt, 0.08) }]}>
                <Ionicons name="wallet-outline" size={12} color={colors.accentAlt} />
                <Text style={[styles.recipientTextSmall, { color: colors.accentAlt }]} numberOfLines={1}>
                  {recipientAddress.slice(0, 6)}...{recipientAddress.slice(-4)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        

        {/* Detailed Transaction Stats */}
        <View style={[styles.detailsCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.5), borderColor: colors.border, marginTop: activeTab === 'bridge' ? 12 : 12 }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Rate</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>1 ETH = 3,450.20 USDC</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Slippage</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>1%</Text>
          </View>
          <View style={styles.detailRow}>
            <View style={styles.labelWithIcon}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Trezo fee</Text>
              <Feather name="info" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </View>
            <Text style={[styles.detailValue, { color: colors.accent, fontWeight: '900' }]}>FREE</Text>
          </View>
        </View>

        {/* Ultimate Action Button */}
        <TouchableOpacity 
          style={[styles.mainActionButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.mainActionButtonText, { color: colors.textOnAccent }]}>
            {activeTab === 'swap' ? 'Review Swap' : 'Review Bridge'}
          </Text>
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
        onSelect={handleAssetSelect}
        assets={tokens}
      />

      <NetworkPickerModal
        isVisible={isNetworkPickerVisible}
        onClose={() => setIsNetworkPickerVisible(false)}
        onSelect={handleNetworkSelect}
        selectedNetworkId={pickingType === 'from' ? fromNetwork.id : toNetwork.id}
      />
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountSelectorMini: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 16,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '800',
  },
  mainCard: {
    borderRadius: 32,
    padding: 0,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  integratedNetworkBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  networkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  networkIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkIconText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  networkName: {
    fontSize: 14,
    fontWeight: '800',
  },
  networkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  networkActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputContainer: {
    padding: 20,
    gap: 10,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  maxButton: {
    fontSize: 13,
    fontWeight: '900',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  tokenSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    gap: 10,
    minWidth: 110,
  },
  tokenSymbol: {
    fontSize: 16,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'right',
    flex: 1,
    letterSpacing: -1,
    padding: 0,
  },
  amountResult: {
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'right',
    letterSpacing: -1,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fiatValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  swapIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'absolute',
    left: '50%',
    marginLeft: -24,
    zIndex: 10,
  },
  bridgeContainer: {
    gap: 16,
  },
  unifiedBridgeCard: {
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    gap: 20,
  },
  bridgeNetworksIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bridgeNetworkHalf: {
    flex: 1,
    gap: 8,
  },
  bridgeMiniLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bridgeNetworkPillIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    gap: 8,
  },
  miniIcon: {
    width: 18,
    height: 18,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniIconText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  bridgeNetworkNameText: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  bridgeArrowBox: {
    marginTop: 20,
  },
  bridgeInputIntegrated: {
    gap: 10,
  },
  bridgeInputRowIntegrated: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  tokenSelectCompactIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    gap: 8,
  },
  tokenSymbolText: {
    fontSize: 16,
    fontWeight: '900',
  },
  bridgeAmountInputIntegrated: {
    fontSize: 32,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
    letterSpacing: -1,
    padding: 0,
  },
  outputBannerIntegrated: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  outputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outputLabelText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  routeBadgeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  routeLabelTextTiny: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  outputValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  outputValueLarge: {
    fontSize: 22,
    fontWeight: '900',
  },
  outputFiatText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bridgeMetaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  metaBadgeGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  recipientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    gap: 6,
  },
  recipientTextSmall: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 120,
  },
  detailsCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  mainActionButton: {
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mainActionButtonText: {
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

export default DexScreen;
