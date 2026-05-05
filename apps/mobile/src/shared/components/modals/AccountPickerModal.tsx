import type { WalletAccount } from '@/src/features/wallet/store/useWalletStore';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '../../../utils/color';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// Re-export for convenience
export type Account = WalletAccount;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AccountPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (account: WalletAccount) => void;
  accounts: WalletAccount[];
  selectedAddress?: string;
}

export const AccountPickerModal: React.FC<AccountPickerModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  accounts = [],
  selectedAddress,
}) => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const isDark = resolvedMode === 'dark';

  // Fallback seed data if no accounts exist
  const displayAccounts = accounts.length > 0 ? accounts : [
    {
      id: 'default',
      address: selectedAddress || '0x742d...40Af',
      name: 'Primary Wallet',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ];

  const handleSelect = (account: WalletAccount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(account);
    onClose();
  };

  const renderItem = ({ item }: { item: WalletAccount }) => {
    const isSelected = item.address === selectedAddress;

    return (
      <TouchableOpacity
        style={[
          styles.accountItem,
          { backgroundColor: isSelected ? withAlpha(colors.accent, 0.1) : 'transparent' },
        ]}
        onPress={() => handleSelect(item)}
      >
        <View style={[styles.avatar, { backgroundColor: isSelected ? colors.accent : colors.surfaceMuted }]}>
          <Text style={[styles.avatarText, { color: isSelected ? colors.textOnAccent : colors.textPrimary }]}>
            {item.name[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.accountInfo}>
          <Text style={[styles.accountName, { color: colors.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.accountAddress, { color: colors.textSecondary }]}>
            {`${item.address.slice(0, 6)}...${item.address.slice(-4)}`}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)' }]} onPress={onClose} />
      
      <View style={[styles.content, { backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF' }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Switch Account</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={displayAccounts}
          renderItem={renderItem}
          keyExtractor={(item) => item.address}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: withAlpha(colors.accent, 0.05) }]}>
                <Ionicons name="wallet-outline" size={32} color={withAlpha(colors.accent, 0.3)} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No accounts found</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Create or import an account to get started.</Text>
            </View>
          }
        />
        
        <TouchableOpacity 
          style={[styles.addButton, { borderColor: colors.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // In a real app, this would trigger account creation flow
          }}
        >
          <Feather name="plus" size={18} color={colors.accent} />
          <Text style={[styles.addButtonText, { color: colors.accent }]}>Add New Account</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  content: {
    height: SCREEN_HEIGHT * 0.6,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountAddress: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.7,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 12,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
