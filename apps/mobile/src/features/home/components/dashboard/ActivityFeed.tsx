import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

export type TransactionType = 'send' | 'receive' | 'swap' | 'deploy';

export interface Transaction {
  id: string;
  type: TransactionType;
  status: 'completed' | 'pending' | 'failed';
  amount?: string;
  symbol?: string;
  timestamp: string;
  address?: string;
}

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'receive',
    status: 'completed',
    amount: '0.25',
    symbol: 'ETH',
    timestamp: '2h ago',
    address: '0x742d...44e',
  },
  {
    id: '2',
    type: 'send',
    status: 'completed',
    amount: '120',
    symbol: 'USDC',
    timestamp: '5h ago',
    address: '0x312a...11b',
  },
  {
    id: '3',
    type: 'swap',
    status: 'completed',
    amount: '0.05',
    symbol: 'ETH → OP',
    timestamp: 'Yesterday',
  },
];

export const ActivityFeed: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const getIcon = (type: TransactionType) => {
    switch (type) {
      case 'send': return 'arrow-up-right';
      case 'receive': return 'arrow-down-left';
      case 'swap': return 'repeat';
      case 'deploy': return 'shield';
      default: return 'activity';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'pending': return colors.warning;
      case 'failed': return colors.danger;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recent Activity</Text>
        <TouchableOpacity>
          <Text style={[styles.seeAll, { color: colors.accent }]}>See All</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.list, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
        {mockTransactions.map((tx, index) => (
          <TouchableOpacity 
            key={tx.id} 
            style={[
              styles.item, 
              index < mockTransactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.border, 0.5) }
            ]}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
              <Feather name={getIcon(tx.type)} size={18} color={colors.accent} />
            </View>
            
            <View style={styles.details}>
              <Text style={[styles.txType, { color: colors.textPrimary }]}>
                {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} {tx.symbol}
              </Text>
              <Text style={[styles.txMeta, { color: colors.textSecondary }]}>
                {tx.status === 'completed' ? tx.timestamp : tx.status} · {tx.address || 'Smart Contract'}
              </Text>
            </View>

            {tx.amount && (
              <View style={styles.amountWrapper}>
                <Text style={[styles.amount, { color: colors.textPrimary }]}>
                  {tx.type === 'send' ? '-' : '+'}{tx.amount}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(tx.status) }]} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
  },
  txType: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  txMeta: {
    fontSize: 12,
    opacity: 0.8,
  },
  amountWrapper: {
    alignItems: 'flex-end',
    gap: 6,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
