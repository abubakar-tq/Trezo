import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { SpringConfig } from '@shared/components/TokenRegistry';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export type QuickActionKey = 'buy' | 'swap' | 'bridge' | 'send' | 'receive';

export type QuickAction = {
  key: QuickActionKey;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
};

export const quickActions: QuickAction[] = [
  { key: 'buy', label: 'Buy', icon: 'plus-circle' },
  { key: 'swap', label: 'Swap', icon: 'repeat' },
  { key: 'send', label: 'Send', icon: 'arrow-up-right' },
  { key: 'receive', label: 'Receive', icon: 'arrow-down-left' },
];

interface ActionItemProps {
  action: QuickAction;
  onPress: (action: QuickAction) => void;
  tint: string;
}

const ActionItem: React.FC<ActionItemProps> = ({ action, onPress, tint }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.88, SpringConfig.interaction); }}
      onPressOut={() => { scale.value = withSpring(1, SpringConfig.interaction); }}
      onPress={() => onPress(action)}
      style={styles.item}
    >
      <Animated.View
        style={[
          styles.circle,
          { backgroundColor: `${tint}18`, borderColor: `${tint}33` },
          animatedStyle,
        ]}
      >
        <Feather name={action.icon} size={20} color={tint} strokeWidth={2} />
      </Animated.View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{action.label}</Text>
    </Pressable>
  );
};

interface ActionGridProps {
  onActionPress: (action: QuickAction) => void;
}

export const ActionGrid: React.FC<ActionGridProps> = ({ onActionPress }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const tints: Record<QuickActionKey, string> = {
    buy: colors.success,
    swap: colors.accent,
    send: colors.accentAlt,
    receive: colors.warning,
    bridge: colors.textMuted,
  };

  return (
    <View style={styles.row}>
      {quickActions.map((action) => (
        <ActionItem
          key={action.key}
          action={action}
          onPress={onActionPress}
          tint={tints[action.key]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  item: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
