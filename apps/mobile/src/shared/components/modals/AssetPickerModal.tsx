import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useAppTheme } from '@theme';
import { TokenIcon } from '../visuals/TokenIcon';
import { withAlpha } from '@utils/color';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface Asset {
  symbol: string;
  name: string;
  logo?: string;
  balance?: string;
  usd_value?: number;
}

interface AssetPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
  assets: Asset[];
  title?: string;
}

const DEFAULT_ASSETS: Asset[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: '1.25', usd_value: 3125.50 },
  { symbol: 'USDT', name: 'Tether USD', balance: '45.00', usd_value: 45.00 },
  { symbol: 'USDC', name: 'USD Coin', balance: '120.5', usd_value: 120.50 },
  { symbol: 'DAI', name: 'Dai Stablecoin', balance: '0.00', usd_value: 0 },
];

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  assets = [],
  title = 'Select Asset',
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const displayAssets = assets.length > 0 ? assets : DEFAULT_ASSETS;

  if (!isVisible) return null;

  const renderItem = ({ item }: { item: Asset }) => (
    <TouchableOpacity
      style={[styles.assetItem, { backgroundColor: withAlpha(colors.surfaceCard, 0.5), borderColor: colors.border }]}
      onPress={() => {
        Haptics.selectionAsync();
        onSelect(item);
        onClose();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.assetLeft}>
        <TokenIcon symbol={item.symbol} size={40} />
        <View style={styles.assetDetails}>
          <Text style={[styles.assetName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.assetSymbol, { color: colors.textSecondary }]}>{item.symbol}</Text>
        </View>
      </View>
      <View style={styles.assetRight}>
        <Text style={[styles.balanceText, { color: colors.textPrimary }]}>
          {parseFloat(item.balance || "0").toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </Text>
        <Text style={[styles.usdValue, { color: colors.textSecondary }]}>
          ${item.usd_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.overlay}>
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={onClose} 
      />
      <View style={[styles.content, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}>
            <Feather name="x" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={displayAssets}
          renderItem={renderItem}
          keyExtractor={(item) => item.symbol}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AVAILABLE ASSETS</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={withAlpha(colors.textSecondary, 0.2)} />
              <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No assets found</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  content: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.8,
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 8,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetDetails: {
    gap: 2,
  },
  assetName: {
    fontSize: 16,
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
  usdValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
});
