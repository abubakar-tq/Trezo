import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
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

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  assets = [],
  title = 'Select Asset',
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const renderItem = ({ item }: { item: Asset }) => (
    <TouchableOpacity
      style={[styles.assetItem, { backgroundColor: withAlpha(colors.surfaceCard, 0.6), borderColor: withAlpha(colors.border, 0.5) }]}
      onPress={() => {
        Haptics.selectionAsync();
        onSelect(item);
        onClose();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.assetLeft}>
        <TokenIcon symbol={item.symbol} size={42} />
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
        <View style={[styles.content, { backgroundColor: colors.surface, borderTopColor: withAlpha(colors.border, 0.4) }]}>
          <View style={[styles.handle, { backgroundColor: withAlpha(colors.border, 0.6) }]} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: withAlpha(colors.surfaceMuted, 0.8) }]}
            >
              <Feather name="x" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={assets}
            renderItem={renderItem}
            keyExtractor={(item) => item.symbol}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              assets.length > 0 ? (
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {assets.length} TOKEN{assets.length !== 1 ? 'S' : ''} AVAILABLE
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={52} color={withAlpha(colors.textSecondary, 0.2)} />
                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No tokens available</Text>
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
    height: SCREEN_HEIGHT * 0.7,
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
    marginBottom: 16,
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
  list: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
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
});
