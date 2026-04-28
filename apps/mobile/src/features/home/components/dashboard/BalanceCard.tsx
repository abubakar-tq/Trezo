import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import Svg, { Path } from 'react-native-svg';

interface BalanceCardProps {
  balance: number;
  loading?: boolean;
  address?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  loading,
  address,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  return (
    <View style={[styles.container, { backgroundColor: theme.mode === 'dark' ? 'rgba(25, 25, 25, 0.65)' : '#FFFFFF', borderColor: colors.border }]}>
        <View style={styles.header}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Balance</Text>
          <View style={[styles.badge, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
            <Feather name="trending-up" size={10} color={colors.accent} />
            <Text style={[styles.badgeText, { color: colors.accent }]}>+4.2%</Text>
          </View>
        </View>

        <View style={styles.balanceRow}>
          <Text style={[styles.currency, { color: colors.textSecondary }]}>$</Text>
          <Text 
            style={[styles.balance, { color: colors.textPrimary }]} 
            numberOfLines={1} 
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {loading ? "---" : (balance >= 1000000000 
              ? `${(balance / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`
              : balance >= 1000000 
                ? `${(balance / 1000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
                : balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
          </Text>
        </View>

        <View style={styles.pulseContainer}>
          <Svg height="40" width="100%">
            <Path
              d="M0 25 Q 40 10, 80 30 T 160 20 T 240 35 T 320 15"
              fill="none"
              stroke={colors.accent}
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />
          </Svg>
        </View>

        <View style={[styles.footer, { borderTopColor: colors.glassBorder }]}>
          <View style={[styles.addressBox, { backgroundColor: colors.surfaceMuted }]}>
            <Feather name="shield" size={12} color={colors.textSecondary} />
            <Text style={[styles.addressText, { color: colors.textSecondary }]}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not Deployed"}
            </Text>
          </View>
          <TouchableOpacity style={styles.copyButton}>
            <Feather name="copy" size={14} color={colors.accent} />
          </TouchableOpacity>
        </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    // Ultimate Borderless Fix: Zero depth
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currency: {
    fontSize: 14,
    fontWeight: '500',
  },
  balance: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pulseContainer: {
    marginTop: 16,
    marginBottom: 8,
    height: 40,
  },
  footer: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  addressText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
