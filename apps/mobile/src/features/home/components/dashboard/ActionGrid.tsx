import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

export type QuickActionKey = 'buy' | 'swap' | 'bridge' | 'send' | 'receive';

export type QuickAction = {
  key: QuickActionKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
};

export const quickActions: QuickAction[] = [
  {
    key: 'buy',
    label: 'Buy',
    icon: 'plus-circle',
  },
  {
    key: 'swap',
    label: 'Swap',
    icon: 'repeat',
  },
  {
    key: 'send',
    label: 'Send',
    icon: 'arrow-up-right',
  },
  {
    key: 'receive',
    label: 'Receive',
    icon: 'arrow-down-left',
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
          activeOpacity={0.7}
          style={styles.actionItem}
          onPress={() => onActionPress(action)}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            <Feather name={action.icon} size={16} color={colors.textPrimary} strokeWidth={1} />
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8, // 35% reduction from 12
  },
  actionItem: {
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    // Add very subtle shadow for light mode visibility
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 0.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
