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
  { key: 'receive', label: 'Receive', icon: 'arrow-down-left' },
  { key: 'send', label: 'Send', icon: 'arrow-up-right' },
  { key: 'swap', label: 'Swap', icon: 'repeat' },
  { key: 'buy', label: 'Buy', icon: 'plus-circle' },
];

interface ActionItemProps {
  action: QuickAction;
  onPress: (action: QuickAction) => void;
  isPrimary: boolean;
  isDisabled?: boolean;
}

const ActionItem: React.FC<ActionItemProps> = ({ action, onPress, isPrimary, isDisabled = false }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!isDisabled) scale.value = withSpring(0.88, SpringConfig.interaction);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.interaction);
  };

  if (isPrimary) {
    // Filled violet pill — THE primary CTA (spec §4)
    return (
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => !isDisabled && onPress(action)}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        disabled={isDisabled}
      >
        <Animated.View
          style={[
            styles.primaryPill,
            {
              backgroundColor: isDisabled ? colors.textMuted : colors.accent,
              borderColor: isDisabled ? colors.border : colors.accent,
            },
            animatedStyle,
          ]}
        >
          <Feather name={action.icon} size={20} color={colors.textOnAccent} strokeWidth={2} />
        </Animated.View>
        <Text style={[styles.label, { color: isDisabled ? colors.textMuted : colors.textPrimary }]}>
          {action.label}
        </Text>
      </Pressable>
    );
  }

  // Quiet/secondary — glass-tinted circle
  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => !isDisabled && onPress(action)}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      disabled={isDisabled}
    >
      <Animated.View
        style={[
          styles.secondaryCircle,
          {
            backgroundColor: isDisabled
              ? `${colors.textMuted}10`
              : `${colors.accent}14`,
            borderColor: isDisabled
              ? colors.border
              : `${colors.accent}30`,
            opacity: isDisabled ? 0.45 : 1,
          },
          animatedStyle,
        ]}
      >
        <Feather
          name={action.icon}
          size={20}
          color={isDisabled ? colors.textMuted : colors.accent}
          strokeWidth={2}
        />
      </Animated.View>
      <Text style={[styles.label, { color: isDisabled ? colors.textMuted : colors.textSecondary }]}>
        {action.label}
      </Text>
    </Pressable>
  );
};

interface ActionGridProps {
  onActionPress: (action: QuickAction) => void;
  /**
   * When true (empty-state): Receive + Buy become primary,
   * and Send + Swap are visually disabled (greyed, non-interactive).
   */
  isEmpty?: boolean;
}

export const ActionGrid: React.FC<ActionGridProps> = ({ onActionPress, isEmpty = false }) => {
  // Funded:  Receive primary, Send primary, Swap secondary, Buy secondary
  // Empty:   Receive primary, Buy primary,  Send disabled,  Swap disabled
  const getVariant = (key: QuickActionKey): { isPrimary: boolean; isDisabled: boolean } => {
    if (isEmpty) {
      if (key === 'receive' || key === 'buy') return { isPrimary: true, isDisabled: false };
      return { isPrimary: false, isDisabled: true };
    }
    // Funded state
    if (key === 'receive' || key === 'send') return { isPrimary: true, isDisabled: false };
    return { isPrimary: false, isDisabled: false };
  };

  return (
    <View style={styles.row}>
      {quickActions.map((action) => {
        const { isPrimary, isDisabled } = getVariant(action.key);
        return (
          <ActionItem
            key={action.key}
            action={action}
            onPress={onActionPress}
            isPrimary={isPrimary}
            isDisabled={isDisabled}
          />
        );
      })}
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
  // Spec §4: "Filled-violet full-pill = THE primary CTA"
  primaryPill: {
    width: 56,
    height: 56,
    // radius 999 = pill/circular (spec §3)
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  // Secondary: subtle tinted circle
  secondaryCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
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
