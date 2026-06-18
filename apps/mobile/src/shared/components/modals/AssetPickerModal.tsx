import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  FlatList,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
  Image,
  TextInput,
} from 'react-native';
import { useAppTheme } from '@theme';
import { TokenIcon } from '../visuals/TokenIcon';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useHoldingsAcrossChains } from '@features/dex/hooks/useHoldingsAcrossChains';
import { getEnabledChains, getChainConfig } from '@/src/integration/chains';
import { getNetworkConfig } from '@/src/integration/networks';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface Asset {
  symbol: string;
  name: string;
  logo?: string;
  balance?: string;
  usd_value?: number;
  /** Optional chain identity — populated by DexScreen via toAsset; used for chain filtering. */
  chainId?: number;
}

interface AssetPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
  assets: Asset[];
  searchableTokens?: Asset[];
  title?: string;
  /** Whether to show the existing chain-ID filter row (default true). Ignored when bridgeChainFilterKeys is set. */
  showChainFilter?: boolean;
  /**
   * When provided, replaces the default chain filter with a plain-text bridge
   * destination chain filter. Each entry is a NetworkKey string.
   */
  bridgeChainFilterKeys?: string[];
  /**
   * Called instead of onSelect when bridgeChainFilterKeys is set.
   * chainKey is the active filter tab's network key, or null if "All" is active.
   */
  onBridgeSelect?: (asset: Asset, chainKey: string | null) => void;
}

const ALL = 'all' as const;
type ChainFilter = typeof ALL | number;

/** Exported for unit testing. Filters an asset list to a specific chainId, or returns all if chainId is null. */
export function filterTokensByBridgeChain(assets: Asset[], chainId: number | null): Asset[] {
  if (chainId === null) return assets;
  return assets.filter((a) => a.chainId !== undefined && a.chainId === chainId);
}

/** Map a chain ID to a TrustWallet icon URL. */
function chainIconUrl(chainId: number): string | undefined {
  switch (chainId) {
    case 1:
    case 11155111:
      return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
    case 42161:
    case 421614:
      return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png';
    case 8453:
    case 84532:
      return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png';
    case 324:
    case 300:
      return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png';
    default:
      return undefined;
  }
}

/** Brand colour for chain fallback badge. */
function chainColor(chainId: number): string {
  switch (chainId) {
    case 1:
    case 11155111:
      return '#627EEA';
    case 42161:
    case 421614:
      return '#28A0F0';
    case 8453:
    case 84532:
      return '#0052FF';
    case 324:
    case 300:
      return '#8C8DFC';
    case 31337:
      return '#4f46e5';
    default:
      return '#888888';
  }
}

interface ChainBadgeProps {
  chainId: number;
}

const ChainBadge: React.FC<ChainBadgeProps> = ({ chainId }) => {
  const iconUri = chainIconUrl(chainId);
  const color = chainColor(chainId);

  if (iconUri) {
    return (
      <Image
        source={{ uri: iconUri }}
        style={styles.chainBadgeImage}
        resizeMode="contain"
      />
    );
  }

  return (
    <View style={[styles.chainBadgeFallback, { backgroundColor: color }]}>
      <Text style={styles.chainBadgeInitial}>
        {(getChainConfig(chainId as any)?.name ?? 'A')[0]}
      </Text>
    </View>
  );
};

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  assets = [],
  searchableTokens,
  title = 'Select Asset',
  showChainFilter = true,
  bridgeChainFilterKeys,
  onBridgeSelect,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const [chainFilter, setChainFilter] = useState<ChainFilter>(ALL);
  const [searchQuery, setSearchQuery] = useState('');

  // Bridge-mode chain filter (network key string) — separate from the existing chain-id filter
  const [activeBridgeChain, setActiveBridgeChain] = useState<string | null>(null);
  const isBridgeMode = Boolean(bridgeChainFilterKeys && bridgeChainFilterKeys.length > 0);

  const holdings = useHoldingsAcrossChains();
  const enabledChains = useMemo(() => getEnabledChains(), []);
  const showFilterRow = showChainFilter && enabledChains.length > 1;

  const normalizedQuery = searchQuery.toLowerCase().trim();

  // Holdings section — filter by chain if active
  const filteredHoldings = useMemo(() => {
    if (chainFilter === ALL) return holdings;
    return holdings.filter((h) => h.chainId === chainFilter);
  }, [holdings, chainFilter]);

  // All tokens section — deduplicated by symbol, alphabetical, chain-filtered
  const filteredAll = useMemo(() => {
    const source = normalizedQuery && searchableTokens ? searchableTokens : assets;

    let list: Asset[];
    if (isBridgeMode) {
      // In bridge mode, filter by the active bridge chain's chainId
      const activeChainId = activeBridgeChain
        ? (() => {
            try { return (getNetworkConfig as any)(activeBridgeChain)?.chainId ?? null; }
            catch { return null; }
          })()
        : null;
      list = filterTokensByBridgeChain(source, activeChainId);
    } else {
      list = chainFilter === ALL
        ? source
        : source.filter((a) => a.chainId === undefined || a.chainId === chainFilter);
    }

    if (normalizedQuery) {
      list = list.filter(
        (a) =>
          a.symbol.toLowerCase().includes(normalizedQuery) ||
          a.name.toLowerCase().includes(normalizedQuery),
      );
      const score = (a: Asset): number => {
        const sym = a.symbol.toLowerCase();
        const name = a.name.toLowerCase();
        if (sym === normalizedQuery) return 0;
        if (sym.startsWith(normalizedQuery)) return 1;
        if (name.startsWith(normalizedQuery)) return 2;
        if (sym.includes(normalizedQuery)) return 3;
        return 4;
      };
      return [...list].sort((a, b) => {
        const diff = score(a) - score(b);
        return diff !== 0 ? diff : a.symbol.localeCompare(b.symbol);
      });
    }
    return [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [assets, searchableTokens, chainFilter, normalizedQuery, isBridgeMode, activeBridgeChain]);

  // Reset filter when modal opens
  React.useEffect(() => {
    if (isVisible) {
      setChainFilter(ALL);
      setSearchQuery('');
      setActiveBridgeChain(null);
    }
  }, [isVisible]);

  const handleSelect = useCallback((asset: Asset) => {
    Haptics.selectionAsync();
    if (isBridgeMode && onBridgeSelect) {
      onBridgeSelect(asset, activeBridgeChain);
    } else {
      onSelect(asset);
    }
    onClose();
  }, [isBridgeMode, onBridgeSelect, onSelect, onClose, activeBridgeChain]);

  const renderHoldingRow = ({ item }: { item: (typeof filteredHoldings)[0] }) => {
    const balanceDisplay = parseFloat(item.balance || '0').toLocaleString(undefined, {
      maximumFractionDigits: 6,
    });

    return (
      <TouchableOpacity
        style={[
          styles.assetItem,
          {
            backgroundColor: `${colors.surfaceCard}99`,
            borderColor: `${colors.border}80`,
          },
        ]}
        onPress={() =>
          handleSelect({
            symbol: item.symbol,
            name: item.name,
            balance: item.balance,
            usd_value: item.valueUsd,
            chainId: item.chainId,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.assetLeft}>
          <View style={styles.iconWrapper}>
            <TokenIcon symbol={item.symbol} size={42} />
            <View style={styles.chainBadgeContainer}>
              <ChainBadge chainId={item.chainId} />
            </View>
          </View>
          <View style={styles.assetDetails}>
            <Text style={[styles.assetName, { color: colors.textPrimary }]}>{item.name}</Text>
            <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>{item.symbol}</Text>
          </View>
        </View>
        <View style={styles.assetRight}>
          <Text style={[styles.balanceText, { color: colors.textPrimary }]}>{balanceDisplay}</Text>
          <Text style={[styles.symbolLabel, { color: colors.textSecondary }]}>{item.symbol}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAllRow = ({ item }: { item: Asset }) => (
    <TouchableOpacity
      style={[
        styles.assetItem,
        {
          backgroundColor: `${colors.surfaceCard}99`,
          borderColor: `${colors.border}80`,
        },
      ]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.assetLeft}>
        <View style={styles.iconWrapper}>
          <TokenIcon symbol={item.symbol} size={42} />
          {item.chainId !== undefined && (
            <View style={styles.chainBadgeContainer}>
              <ChainBadge chainId={item.chainId} />
            </View>
          )}
        </View>
        <View style={styles.assetDetails}>
          <Text style={[styles.assetName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>{item.symbol}</Text>
        </View>
      </View>
      <View style={styles.assetRight}>
        <Text style={[styles.balanceText, { color: colors.textPrimary }]}>
          {parseFloat(item.balance || '0').toLocaleString(undefined, { maximumFractionDigits: 6 })}
        </Text>
        <Text style={[styles.symbolLabel, { color: colors.textSecondary }]}>{item.symbol}</Text>
      </View>
    </TouchableOpacity>
  );

  const sections = useMemo(() => {
    const result: { title: string; data: any[]; kind: 'holdings' | 'all' }[] = [];
    if (filteredHoldings.length > 0) {
      result.push({ title: 'YOUR HOLDINGS', data: filteredHoldings, kind: 'holdings' });
    }
    if (filteredAll.length > 0) {
      result.push({ title: 'ALL TOKENS', data: filteredAll, kind: 'all' });
    }
    return result;
  }, [filteredHoldings, filteredAll]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.content,
            { backgroundColor: colors.surface, borderTopColor: `${colors.border}66` },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: `${colors.border}99` }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: `${colors.surfaceMuted}CC` }]}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Chain filter row — bridge mode or default */}
          {isBridgeMode ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bridgeFilterRow}
            >
              {(['all', ...(bridgeChainFilterKeys ?? [])] as string[]).map((key) => {
                const isActive = key === 'all' ? activeBridgeChain === null : activeBridgeChain === key;
                const label = key === 'all'
                  ? 'All'
                  : (() => { try { return (getNetworkConfig as any)(key)?.displayName ?? key; } catch { return key; } })();
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setActiveBridgeChain(key === 'all' ? null : key)}
                    style={styles.bridgeFilterTab}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.bridgeFilterTabText,
                        { color: isActive ? colors.accent : colors.textSecondary },
                      ]}
                    >
                      {label}
                    </Text>
                    {isActive && (
                      <View style={[styles.bridgeFilterTabUnderline, { backgroundColor: colors.accent }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            showFilterRow && (
              <FlatList
                data={[ALL, ...enabledChains.map((c) => c.id)] as ChainFilter[]}
                horizontal
                keyExtractor={(item) => String(item)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item }) => {
                  const isActive = chainFilter === item;
                  const label = item === ALL ? 'All' : (getChainConfig(item as any)?.name ?? String(item));
                  return (
                    <TouchableOpacity
                      onPress={() => setChainFilter(item)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isActive
                            ? `${colors.accent}22`
                            : `${colors.surfaceMuted}CC`,
                          borderColor: isActive ? colors.accent : `${colors.border}80`,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      {item !== ALL && (
                        <View style={styles.filterChipDot}>
                          <ChainBadge chainId={item as number} />
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.filterChipText,
                          { color: isActive ? colors.accent : colors.textSecondary, maxWidth: 110 },
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )
          )}

          <SectionList
            sections={sections}
            keyExtractor={(item, index) =>
              'symbol' in item ? `${item.symbol}-${('chainId' in item ? item.chainId : 0)}-${index}` : String(index)
            }
            renderItem={({ item, section }) =>
              section.kind === 'holdings' ? renderHoldingRow({ item }) : renderAllRow({ item })
            }
            renderSectionHeader={({ section }) => (
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {section.title}
              </Text>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={52} color={`${colors.textSecondary}33`} />
                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
                  No tokens available
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Switch to a supported network
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  content: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    height: SCREEN_HEIGHT * 0.75,
    borderTopWidth: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    minHeight: 30,
    minWidth: 70,
  },
  filterChipDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    position: 'relative',
  },
  chainBadgeContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chainBadgeImage: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  chainBadgeFallback: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainBadgeInitial: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  assetDetails: {
    gap: 2,
  },
  assetName: {
    fontSize: 15,
    fontWeight: '700',
  },
  assetSymbol: {
    fontSize: 12,
    fontWeight: '600',
  },
  assetRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '700',
  },
  symbolLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 72,
    gap: 6,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    fontWeight: '500',
  },
  bridgeFilterRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 0,
  },
  bridgeFilterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 16,
    alignItems: 'center',
  },
  bridgeFilterTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bridgeFilterTabUnderline: {
    height: 2,
    width: '100%',
    borderRadius: 1,
    marginTop: 3,
  },
});
