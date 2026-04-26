import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

export type QuickActionKey = 'send' | 'receive' | 'buy' | 'swap';

export type QuickAction = {
  key: QuickActionKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  description: string;
};

export const quickActions: QuickAction[] = [
  {
    key: 'send',
    label: 'Send',
    icon: 'arrow-up-right',
    description: 'Move assets from your wallet to another address.',
  },
  {
    key: 'receive',
    label: 'Receive',
    icon: 'arrow-down-left',
    description: 'Generate deposit details to receive funds securely.',
  },
  {
    key: 'buy',
    label: 'Buy',
    icon: 'credit-card',
    description: 'Purchase crypto with fiat using curated providers.',
  },
  {
    key: 'swap',
    label: 'Swap',
    icon: 'repeat',
    description: 'Exchange one token for another without leaving Trezo.',
  },
];

interface ActionGridProps {
  onActionPress: (action: QuickAction) => void;
}

export const ActionGrid: React.FC<ActionGridProps> = ({ onActionPress }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  return (
    <View style={styles.container}>
      {quickActions.map((action) => (
        <TouchableOpacity
          key={action.key}
          activeOpacity={0.85}
          style={[styles.button, { backgroundColor: colors.surfaceCard }]}
          onPress={() => onActionPress(action)}
        >
          <View style={[styles.iconWrapper, { backgroundColor: withAlpha(colors.accent, 0.12) }]}>
            <Feather name={action.icon} size={20} color={colors.accent} />
          </View>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
