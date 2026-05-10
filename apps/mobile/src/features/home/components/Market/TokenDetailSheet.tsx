import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import type { MarketToken } from '@lib/api/web3Data';
import { useUserHoldsToken } from '@features/wallet/hooks/useUserHoldsToken';
import { isTokenSwappableOnTestnet } from '@services/market/testnetBias';

interface TokenDetailSheetProps {
  visible: boolean;
  token: MarketToken | null;
  onClose: () => void;
  formatPrice: (price: any) => string;
  formatChange: (change: any) => string;
  onRequestSend: (token: MarketToken) => void;
  onRequestReceive: () => void;
  onRequestSwap: (preselect: { symbol: string; side: 'in' | 'out' }) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Minimal tile used for the three action buttons.
interface ActionTileProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  accent: string;
  accentBg: string;
  textOnAccent: string;
}

const ActionTile: React.FC<ActionTileProps> = ({ icon, label, onPress, accent, accentBg, textOnAccent }) => (
  <TouchableOpacity
    style={[tileSt.tile, { backgroundColor: accentBg }]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Feather name={icon} size={20} color={accent} />
    <Text style={[tileSt.label, { color: accent }]}>{label}</Text>
  </TouchableOpacity>
);

const tileSt = StyleSheet.create({
  tile: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});

const TokenDetailSheet: React.FC<TokenDetailSheetProps> = ({
  visible,
  token,
  onClose,
  formatPrice,
  formatChange,
  onRequestSend,
  onRequestReceive,
  onRequestSwap,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const symbol = token?.symbol ?? '';
  const swappable = isTokenSwappableOnTestnet(symbol);
  const userHolds = useUserHoldsToken(symbol);

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
              <View style={[styles.iconContainer, { backgroundColor: `${colors.accent}1A` }]}>
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
            <View style={[styles.badge, { backgroundColor: isPositive ? colors.successSoft : colors.dangerSoft }]}>
              <Text style={{ color: isPositive ? colors.success : colors.danger, fontWeight: '700' }}>
                {formatChange(token.change24h)}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <ActionTile
              icon="arrow-up-right"
              label="Send"
              onPress={() => { onClose(); onRequestSend(token); }}
              accent={colors.accent}
              accentBg={`${colors.accent}1A`}
              textOnAccent={colors.textOnAccent}
            />
            <ActionTile
              icon="arrow-down-left"
              label="Receive"
              onPress={() => { onClose(); onRequestReceive(); }}
              accent={colors.accent}
              accentBg={`${colors.accent}1A`}
              textOnAccent={colors.textOnAccent}
            />
            {swappable ? (
              <ActionTile
                icon="repeat"
                label="Swap"
                onPress={() => { onClose(); onRequestSwap({ symbol: token.symbol, side: userHolds ? 'in' : 'out' }); }}
                accent={colors.accent}
                accentBg={`${colors.accent}1A`}
                textOnAccent={colors.textOnAccent}
              />
            ) : (
              <View style={[styles.notAvailable, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.notAvailableText, { color: colors.textMuted }]}>Not available</Text>
              </View>
            )}
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
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  notAvailable: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notAvailableText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TokenDetailSheet;
