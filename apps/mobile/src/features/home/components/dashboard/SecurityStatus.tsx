import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

export const SecurityStatus: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  return (
    <View style={[styles.container, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
          <Feather name="shield" size={20} color={colors.success} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Guardian Protection Active</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>3 guardians securing your account</Text>
        </View>
      </View>
      <TouchableOpacity style={[styles.manageButton, { backgroundColor: withAlpha(colors.accent, 0.15) }]}>
        <Text style={[styles.manageText, { color: colors.accent }]}>Manage</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  manageButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  manageText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
