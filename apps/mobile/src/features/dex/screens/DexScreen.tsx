import React, { useState, useMemo } from 'react';
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
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import { TabScreenContainer, MeshBackground, TokenIcon } from '@shared/components';
import { useTabContentBottomInset } from '@app/hooks';

const { width } = Dimensions.get('window');

type DexTab = 'swap' | 'bridge';

export const DexScreen: React.FC = () => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const contentBottomInset = useTabContentBottomInset();
  const [activeTab, setActiveTab] = useState<DexTab>('swap');
  const [fromNetwork, setFromNetwork] = useState('Ethereum');
  const [toNetwork, setToNetwork] = useState('Arbitrum');
  const [recipientAddress, setRecipientAddress] = useState('0x4b0c...3796');
  
  const isDark = resolvedMode === 'dark';
  const glassBackground = isDark ? 'rgba(25, 25, 25, 0.65)' : '#FFFFFF';

  return (
    <TabScreenContainer includeBottomInset>
      <MeshBackground intensity={0.8} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Tabs */}
        <View style={styles.header}>
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              onPress={() => setActiveTab('swap')}
              style={[styles.tab, activeTab === 'swap' && styles.activeTab]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'swap' ? colors.textPrimary : colors.textSecondary }]}>Swap</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveTab('bridge')}
              style={[styles.tab, activeTab === 'bridge' && styles.activeTab]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'bridge' ? colors.textPrimary : colors.textSecondary }]}>Bridge</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.glass }]}>
              <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.profilePlaceholder}>
               <View style={[styles.avatar, { backgroundColor: colors.accent }]} />
            </View>
          </View>
        </View>

        {/* Network Selection Row (Bridge specific) */}
        {activeTab === 'bridge' ? (
          <View style={styles.bridgeNetworkRow}>
            <TouchableOpacity style={[styles.networkPill, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>From</Text>
              <View style={styles.pillContent}>
                <View style={[styles.miniIcon, { backgroundColor: '#627EEA' }]}>
                  <Text style={styles.miniIconText}>Ξ</Text>
                </View>
                <Text style={[styles.pillName, { color: colors.textPrimary }]}>{fromNetwork}</Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.bridgeSwapButton, { backgroundColor: colors.glass }]}>
              <Ionicons name="arrow-forward" size={16} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.networkPill, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <Text style={[styles.pillLabel, { color: colors.textSecondary }]}>To</Text>
              <View style={styles.pillContent}>
                <View style={[styles.miniIcon, { backgroundColor: '#96BED9' }]}>
                  <Text style={styles.miniIconText}>A</Text>
                </View>
                <Text style={[styles.pillName, { color: colors.textPrimary }]}>{toNetwork}</Text>
                <Feather name="chevron-down" size={14} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.networkSelector, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <View style={styles.networkInfo}>
               <View style={[styles.networkIcon, { backgroundColor: '#627EEA' }]}>
                 <Text style={styles.networkIconText}>Ξ</Text>
               </View>
               <Text style={[styles.networkName, { color: colors.textPrimary }]}>{fromNetwork}</Text>
            </View>
            <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Main Interface Card */}
        {activeTab === 'swap' ? (
          <View style={[styles.mainCard, { backgroundColor: glassBackground, borderColor: colors.border }]}>
            {/* Pay Section */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Pay with</Text>
                <TouchableOpacity>
                  <Text style={[styles.maxButton, { color: colors.accent }]}>Max</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputRow}>
                <TouchableOpacity style={styles.tokenSelect}>
                  <TokenIcon symbol="USDC" size={32} style={{ marginRight: 8 }} />
                  <Text style={[styles.tokenSymbol, { color: colors.textPrimary }]}>USDC</Text>
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
                <Text style={[styles.balanceText, { color: colors.danger }]}>Balance: 0.00</Text>
                <Text style={[styles.fiatValue, { color: colors.textMuted }]}>$84.99</Text>
              </View>
            </View>

            {/* Swap Middle Divider */}
            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={[styles.swapIconButton, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <Ionicons name="swap-vertical" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Receive Section */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Receive</Text>
              </View>
              <View style={styles.inputRow}>
                <TouchableOpacity style={styles.tokenSelect}>
                  <TokenIcon symbol="ETH" size={32} style={{ marginRight: 8 }} />
                  <Text style={[styles.tokenSymbol, { color: colors.textPrimary }]}>ETH</Text>
                  <Feather name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={[styles.amountResult, { color: colors.textPrimary }]}>0.02451</Text>
              </View>
              <View style={styles.inputFooter}>
                <Text style={[styles.balanceText, { color: colors.textMuted }]}>Balance: 0.00</Text>
                <Text style={[styles.fiatValue, { color: colors.textMuted }]}>≈$83.56 (-0.69%)</Text>
              </View>
            </View>
          </View>
        ) : (
          /* "One Page" Compact Bridge Redesign */
          <View style={styles.bridgeContainer}>
            <View style={[styles.unifiedBridgeCard, { backgroundColor: glassBackground, borderColor: colors.border }]}>
               <View style={styles.compactBridgeInput}>
                  <View style={styles.bridgeInputRow}>
                    <TouchableOpacity style={styles.tokenSelectCompact}>
                       <TokenIcon symbol="USDC" size={32} />
                       <Text style={[styles.tokenSymbol, { color: colors.textPrimary, fontSize: 18 }]}>USDC</Text>
                       <Feather name="chevron-down" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TextInput 
                      style={[styles.bridgeAmountInputCompact, { color: colors.textPrimary }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      defaultValue="85.00"
                    />
                  </View>
                  <View style={styles.bridgeInputFooter}>
                    <Text style={[styles.balanceTextSmall, { color: colors.textMuted }]}>Balance: 0.00</Text>
                    <TouchableOpacity>
                      <Text style={[styles.maxButtonSmall, { color: colors.accent }]}>USE MAX</Text>
                    </TouchableOpacity>
                  </View>
               </View>
               
               {/* Unified Transfer Route Visual */}
               <View style={styles.compactTransferRow}>
                  <View style={styles.transferChain}>
                    <View style={[styles.chainDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.chainLabel, { color: colors.textSecondary }]}>{fromNetwork}</Text>
                  </View>
                  <View style={styles.transferArrowBox}>
                    <View style={[styles.transferLineSolid, { backgroundColor: colors.border }]} />
                    <View style={[styles.planeIconBox, { backgroundColor: colors.surfaceMuted }]}>
                      <Ionicons name="airplane" size={14} color={colors.accent} />
                    </View>
                    <View style={[styles.transferLineSolid, { backgroundColor: colors.border }]} />
                  </View>
                  <View style={styles.transferChain}>
                    <View style={[styles.chainDot, { backgroundColor: colors.accentAlt }]} />
                    <Text style={[styles.chainLabel, { color: colors.textSecondary }]}>{toNetwork}</Text>
                  </View>
               </View>

               <View style={[styles.outputBanner, { backgroundColor: withAlpha(colors.accent, 0.05) }]}>
                  <Text style={[styles.outputLabel, { color: colors.textSecondary }]}>RECEIVE ESTIMATE</Text>
                  <Text style={[styles.outputValue, { color: colors.textPrimary }]}>84.75 USDC</Text>
                  <Text style={[styles.outputFiat, { color: colors.textMuted }]}>≈ $84.72</Text>
               </View>
            </View>

            {/* Compact Optimized Route */}
            <View style={[styles.routePill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
               <View style={styles.routeLeft}>
                 <Ionicons name="flash" size={14} color={colors.accent} />
                 <Text style={[styles.routeLabelSmall, { color: colors.textPrimary }]}>Stargate Finance (Fastest)</Text>
               </View>
               <Text style={[styles.routeTimeSmall, { color: colors.textSecondary }]}>~ 3 mins</Text>
            </View>

            {/* Recipient - Now integrated and smaller */}
            <View style={styles.recipientRowCompact}>
              <Text style={[styles.recipientTitleSmall, { color: colors.textMuted }]}>RECIPIENT:</Text>
              <TouchableOpacity style={styles.addressPillCompact}>
                <Text style={[styles.addressTextSmall, { color: colors.accent }]} numberOfLines={1}>{recipientAddress}</Text>
                <Feather name="edit-2" size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Transaction Details - Unified for both */}
        <View style={[styles.detailsCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.5), borderColor: colors.border, marginTop: activeTab === 'bridge' ? 0 : 12 }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Rate</Text>
            <Text style={[styles.detailValue, { color: colors.accent }]}>1 ETH = 3,450.20 USDC</Text>
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
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>0.5%</Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity 
          style={[styles.mainActionButton, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}
          disabled
        >
          <Text style={[styles.mainActionButtonText, { color: colors.textMuted }]}>Insufficient balance</Text>
        </TouchableOpacity>

      </ScrollView>
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  tab: {
    paddingVertical: 8,
  },
  activeTab: {
    borderBottomWidth: 0, // We'll use text color only for minimalist look, or add a dot
  },
  tabText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatar: {
    flex: 1,
  },
  networkSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    alignSelf: 'flex-start',
    minWidth: 140,
  },
  networkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  networkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    fontWeight: '700',
  },
  bridgeNetworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  networkPill: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillName: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  miniIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniIconText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bridgeSwapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipientCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  recipientHeader: {
    marginBottom: 12,
  },
  recipientTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  addressSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
  },
  addressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chainIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  mainCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  inputContainer: {
    gap: 12,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  maxButton: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tokenSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenIconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tokenSymbol: {
    fontSize: 22,
    fontWeight: '900',
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
  },
  amountResult: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'right',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fiatValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  swapIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 12,
  },
  detailsCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 24,
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
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  mainActionButton: {
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  mainActionButtonText: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Unified Bridge Styles
  unifiedBridgeCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  compactBridgeInput: {
    gap: 8,
    marginBottom: 20,
  },
  bridgeInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  tokenSelectCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 8,
    borderRadius: 12,
  },
  bridgeAmountInputCompact: {
    fontSize: 28,
    fontWeight: '900',
    flex: 1,
    textAlign: 'right',
  },
  bridgeInputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTextSmall: {
    fontSize: 12,
    fontWeight: '600',
  },
  maxButtonSmall: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  compactTransferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  transferChain: {
    alignItems: 'center',
    gap: 4,
  },
  chainDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chainLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  transferArrowBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  transferLineSolid: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
  planeIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  outputBanner: {
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  outputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  outputValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  outputFiat: {
    fontSize: 12,
    fontWeight: '600',
  },
  routePill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  routeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeLabelSmall: {
    fontSize: 12,
    fontWeight: '700',
  },
  routeTimeSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  recipientRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recipientTitleSmall: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  addressPillCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addressTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 160,
  },
});

export default DexScreen;
