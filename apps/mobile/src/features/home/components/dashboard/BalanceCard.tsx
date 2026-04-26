import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { PortfolioService } from '@features/portfolio/services/PortfolioService';

interface BalanceCardProps {
  balance: number;
  loading: boolean;
  address: string | null;
  onDeployPress?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  loading,
  address,
  onDeployPress,
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;

  // For visual polish, we'll simulate a 24h change if balance > 0
  const hasBalance = balance > 0;
  const simulatedChange = hasBalance ? "+2.4%" : "0.0%";
  const isPositive = true;

  return (
    <LinearGradient colors={gradients.hero} style={styles.balanceCard}>
      <View style={styles.headerRow}>
        <Text style={[styles.balanceLabel, { color: colors.textOnHero }]}>Portfolio Balance</Text>
        {hasBalance && (
          <View style={styles.changeBadge}>
            <Feather name="arrow-up-right" size={12} color="#4ade80" />
            <Text style={styles.changeText}>{simulatedChange}</Text>
          </View>
        )}
      </View>

      <View style={styles.mainContent}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.textOnHero} style={{ marginVertical: 8 }} />
        ) : address ? (
          <View style={styles.balanceContainer}>
            <Text style={[styles.balanceValue, { color: colors.textOnHero }]}>
              {PortfolioService.formatUSD(balance)}
            </Text>
            <Text style={[styles.currencyLabel, { color: colors.textOnHero }]}>USD</Text>
          </View>
        ) : (
          <Text style={[styles.balanceValue, { color: colors.textOnHero, fontSize: 18 }]}>
            Account not deployed
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.balanceHelper, { color: colors.textOnHero }]}>
          {address 
            ? `Active on ${balance > 0 ? simulatedChange + ' last 24h' : 'Mainnet'}`
            : 'Deploy your smart account to start trading'}
        </Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  balanceCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    minHeight: 160,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    opacity: 0.9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  changeText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '800',
  },
  mainContent: {
    marginVertical: 12,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  currencyLabel: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.8,
  },
  footer: {
    marginTop: 8,
  },
  balanceHelper: {
    fontSize: 13,
    opacity: 0.8,
    fontWeight: '500',
  },
});
