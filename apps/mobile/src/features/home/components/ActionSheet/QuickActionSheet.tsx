import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

interface QuickActionSheetProps {
  visible: boolean;
  action: string | null;
  onDismiss: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  visible,
  action,
  onDismiss,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  if (!action) return null;

  const actions = [
    { id: 'send', label: 'Send Crypto', icon: 'send', color: colors.accent },
    { id: 'receive', label: 'Receive Assets', icon: 'download', color: colors.success },
    { id: 'swap', label: 'Swap Tokens', icon: 'refresh-cw', color: colors.warning },
    { id: 'buy', label: 'Buy with Fiat', icon: 'shopping-cart', color: colors.accent },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onDismiss}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          style={[styles.sheet, { backgroundColor: colors.surfaceCard }]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderMuted }]} />
          
          <Text style={[styles.title, { color: colors.textPrimary }]}>Quick Actions</Text>
          
          <View style={styles.grid}>
            {actions.map((item) => (
              <TouchableOpacity 
                key={item.id}
                style={[styles.item, { backgroundColor: withAlpha(item.color, 0.1) }]}
                onPress={onDismiss}
              >
                <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                  <Feather name={item.icon as any} size={24} color={colors.textOnAccent} />
                </View>
                <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.cancelButton, { backgroundColor: colors.borderMuted }]}
            onPress={onDismiss}
          >
            <Text style={[styles.cancelText, { color: colors.textPrimary }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 32,
  },
  item: {
    width: '47%',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '800',
  },
});

export default QuickActionSheet;
