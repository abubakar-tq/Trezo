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

interface ActivityFeedProps {
  limit?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ limit }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const displayTransactions = limit ? mockTransactions.slice(0, limit) : mockTransactions;

  const getIcon = (type: TransactionType) => {
    switch (type) {
      case 'send': return 'arrow-up-right';
      case 'receive': return 'arrow-down-left';
      case 'swap': return 'repeat';
      case 'deploy': return 'shield';
      default: return 'activity';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Activity</Text>
        <TouchableOpacity>
          <Text style={[styles.seeAll, { color: colors.accent }]}>Full History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {displayTransactions.map((tx, index) => (
          <TouchableOpacity 
            key={tx.id} 
            style={[
              styles.item,
              index !== displayTransactions.length - 1 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.accent, 0.08) }
            ]}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                <Feather name={getIcon(tx.type)} size={16} color={colors.accent} strokeWidth={1.5} />
              </View>
              <View style={styles.textContainer}>
                <Text 
                  style={[styles.typeText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} {tx.symbol}
                </Text>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>{tx.timestamp}</Text>
              </View>
            </View>
            
            <View style={styles.itemRight}>
              {tx.amount && (
                <Text 
                  style={[styles.amountText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {tx.type === 'send' ? '-' : '+'}{tx.amount}
                </Text>
              )}
              <View style={[styles.statusIndicator, { backgroundColor: tx.status === 'completed' ? colors.accent : colors.warning }]} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  list: {
    gap: 0,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 80,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.65,
    gap: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  itemRight: {
    flex: 0.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  statusIndicator: {
    width: 6,
    height: 14,
    borderRadius: 3,
  },
});
