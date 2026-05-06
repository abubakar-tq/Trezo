import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import { Sparkline } from '@shared/components/Sparkline';

interface BalanceCardProps {
  balance: number;
  loading?: boolean;
  address?: string;
  isDeployed?: boolean;
  isHydrating?: boolean;
  hasLocalPasskey?: boolean | null;
  missingPrices?: string[];
  onDeploy?: () => void;
  onEnablePasskey?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  loading,
  address,
  isDeployed = true,
  isHydrating = false,
  hasLocalPasskey = null,
  missingPrices,
  onDeploy,
  onEnablePasskey,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const { width } = Dimensions.get('window');

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Balance</Text>
          {isHydrating ? (
            <View style={[styles.badge, { backgroundColor: withAlpha(colors.textSecondary, 0.08) }]}>
              <Feather name="refresh-cw" size={10} color={colors.textSecondary} />
              <Text style={[styles.badgeText, { color: colors.textSecondary }]}>Syncing...</Text>
            </View>
          ) : isDeployed ? (
            hasLocalPasskey === false ? (
              <TouchableOpacity
                onPress={onEnablePasskey}
                style={[styles.deployBadge, { backgroundColor: withAlpha('#8B5CF6', 0.15), borderColor: withAlpha('#8B5CF6', 0.35) }]}
                activeOpacity={0.8}
              >
                <Feather name="key" size={10} color="#8B5CF6" />
                <Text style={[styles.badgeText, { color: '#8B5CF6', marginLeft: 4 }]}>Enable Passkey</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.badge, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                <Feather name="trending-up" size={10} color={colors.accent} />
                <Text style={[styles.badgeText, { color: colors.accent }]}>+4.2%</Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              onPress={onDeploy}
              style={[styles.deployBadge, { backgroundColor: withAlpha('#F59E0B', 0.15), borderColor: withAlpha('#F59E0B', 0.35) }]}
              activeOpacity={0.8}
            >
              <Feather name="zap" size={10} color="#F59E0B" />
              <Text style={[styles.badgeText, { color: '#F59E0B', marginLeft: 4 }]}>Activate Wallet</Text>
            </TouchableOpacity>
          )}
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

        {missingPrices && missingPrices.length > 0 ? (
          <Text style={[styles.missingPriceHint, { color: colors.textMuted }]}>
            USD unavailable for {missingPrices.length} token{missingPrices.length === 1 ? "" : "s"}
          </Text>
        ) : null}


        <View style={[styles.footer, { borderTopColor: colors.glassBorder }]}>
          <View style={[styles.addressBox, { backgroundColor: colors.surfaceMuted }]}>
            <Feather name={isDeployed ? "shield" : "alert-circle"} size={12} color={isDeployed ? colors.textSecondary : '#F59E0B'} />
            <Text style={[styles.addressText, { color: isDeployed ? colors.textSecondary : '#F59E0B' }]}>
              {address 
                ? (isDeployed ? `${address.slice(0, 6)}...${address.slice(-4)}` : `${address.slice(0, 6)}...${address.slice(-4)} · Not Deployed`)
                : "No wallet"}
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
  deployBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
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
    fontSize: 20,
    fontWeight: '800',
    marginRight: 2,
  },
  balance: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  missingPriceHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "500",
  },
  pulseContainer: {
    marginTop: 16,
    marginBottom: 8,
    height: 48,
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
