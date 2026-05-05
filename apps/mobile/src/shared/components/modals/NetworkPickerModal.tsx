import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TokenIcon } from '../visuals/TokenIcon';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface Network {
  id: string;
  name: string;
  chainId: number;
  icon?: string;
  color: string;
  isMainnet?: boolean;
}

const NETWORKS: Network[] = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1, color: '#627EEA', isMainnet: true, icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
  { id: 'polygon', name: 'Polygon', chainId: 137, color: '#8247E5', isMainnet: true, icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png' },
  { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, color: '#28A0F0', isMainnet: true, icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png' },
  { id: 'optimism', name: 'Optimism', chainId: 10, color: '#FF0420', isMainnet: true, icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png' },
  { id: 'base', name: 'Base', chainId: 8453, color: '#0052FF', isMainnet: true, icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png' },
  { id: 'scroll', name: 'Scroll', chainId: 534352, color: '#FFDBB0', isMainnet: true, icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/scroll/info/logo.png' },
  { id: 'zksync', name: 'zkSync Era', chainId: 324, color: '#8C8DFC', isMainnet: true, icon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png' },
  { id: 'anvil', name: 'Anvil', chainId: 31337, color: '#4f46e5', isMainnet: false },
];

interface NetworkPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (network: Network) => void;
  selectedNetworkId?: string;
}

export const NetworkPickerModal: React.FC<NetworkPickerModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  selectedNetworkId,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  if (!isVisible) return null;

  const renderItem = ({ item }: { item: Network }) => {
    const isSelected = item.id === selectedNetworkId;
    
    return (
      <TouchableOpacity
        style={[
          styles.networkItem,
          { 
            backgroundColor: isSelected ? withAlpha(colors.accent, 0.1) : withAlpha(colors.surfaceCard, 0.5),
            borderColor: isSelected ? colors.accent : colors.border
          }
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          onSelect(item);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.networkInfo}>
          {item.icon ? (
            <TokenIcon uri={item.icon} symbol={item.name[0]} size={32} />
          ) : (
            <View style={[styles.networkIcon, { backgroundColor: item.color }]}>
              <Text style={styles.networkInitial}>{item.name[0]}</Text>
            </View>
          )}
          <View>
            <Text style={[styles.networkName, { color: colors.textPrimary }]}>{item.name}</Text>
            <Text style={[styles.networkChain, { color: colors.textSecondary }]}>
              {item.isMainnet ? 'Mainnet' : 'Testnet'} • ID: {item.chainId}
            </Text>
          </View>
        </View>
        {isSelected && (
          <View style={[styles.checkContainer, { backgroundColor: colors.accent }]}>
            <Feather name="check" size={12} color={colors.textOnAccent} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={onClose} 
      />
      <View style={[styles.content, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Select Network</Text>
          <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}>
            <Feather name="x" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={NETWORKS}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>AVAILABLE NETWORKS</Text>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  content: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    maxHeight: SCREEN_HEIGHT * 0.8,
    borderTopWidth: 1,
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
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 8,
  },
  networkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
  },
  networkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  networkIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkInitial: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '700',
  },
  networkChain: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
