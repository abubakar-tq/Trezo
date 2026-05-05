import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import type { MarketToken } from '@lib/api/web3Data';

interface TokenDetailSheetProps {
  visible: boolean;
  token: MarketToken | null;
  onClose: () => void;
  formatPrice: (price: any) => string;
  formatChange: (change: any) => string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const TokenDetailSheet: React.FC<TokenDetailSheetProps> = ({
  visible,
  token,
  onClose,
  formatPrice,
  formatChange,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  if (!token) return null;

  const isPositive = (token.change24h || 0) >= 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          style={[styles.sheet, { backgroundColor: colors.surfaceCard }]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderMuted }]} />
          
          <View style={styles.header}>
            <View style={styles.tokenInfo}>
              <View style={[styles.iconContainer, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                <Text style={{ fontSize: 24 }}>{token.symbol.charAt(0)}</Text>
              </View>
              <View>
                <Text style={[styles.tokenName, { color: colors.textPrimary }]}>{token.name}</Text>
                <Text style={[styles.tokenSymbol, { color: colors.textSecondary }]}>{token.symbol}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: colors.textPrimary }]}>{formatPrice(token.priceUsd)}</Text>
            <View style={[styles.badge, { backgroundColor: isPositive ? withAlpha(colors.success, 0.1) : withAlpha(colors.danger, 0.1) }]}>
              <Text style={{ color: isPositive ? colors.success : colors.danger, fontWeight: '700' }}>
                {formatChange(token.change24h)}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.accent }]}>
              <Text style={{ color: colors.textOnAccent, fontWeight: '700' }}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Swap</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: SCREEN_HEIGHT * 0.4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenName: {
    fontSize: 20,
    fontWeight: '800',
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  price: {
    fontSize: 40,
    fontWeight: '900',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TokenDetailSheet;
