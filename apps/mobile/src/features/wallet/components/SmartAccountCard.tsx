import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Clipboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '@store/useUserStore';
import { PasskeyService } from '../services/PasskeyService';
import { predictAccountAddress, isContractDeployed } from '../../../integration/viem';
import type { Hex } from 'viem';

export const SmartAccountCard = () => {
  const authUser = useUserStore((state) => state.user);
  const userId = authUser?.id ?? null;
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const setSmartAccountAddress = useUserStore((state) => state.setSmartAccountAddress);
  const setSmartAccountDeployed = useUserStore((state) => state.setSmartAccountDeployed);

  // Check deployment status on mount if we have an address but don't know if it's deployed
  useEffect(() => {
    const checkStatus = async () => {
      if (!userId) return;
      
      try {
        const passkey = await PasskeyService.getPasskey(userId);
        if (!passkey) return;

        const chainId = 31337;
        const salt = passkey.credentialIdRaw as Hex;
        
        // If we don't have an address yet, predict it
        if (!smartAccountAddress) {
          const predicted = await predictAccountAddress(chainId, salt);
          setSmartAccountAddress(predicted);
          
          // Check if it's deployed
          const deployed = await isContractDeployed(chainId, predicted);
          setSmartAccountDeployed(deployed);
        } else if (!smartAccountDeployed) {
          // If we have an address but don't know if it's deployed, check
          const deployed = await isContractDeployed(chainId, smartAccountAddress as Hex);
          setSmartAccountDeployed(deployed);
        }
      } catch (error) {
        console.error('[SmartAccountCard] Failed to check status:', error);
      }
    };

    checkStatus();
  }, [userId]);

  const handleCopyAddress = async () => {
    if (!smartAccountAddress) return;
    
    Clipboard.setString(smartAccountAddress);
    Alert.alert('Copied!', 'Smart account address copied to clipboard', [{ text: 'OK' }]);
  };

  if (!smartAccountAddress) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Feather name="shield" size={20} color="#666" />
          <Text style={styles.title}>Smart Account</Text>
        </View>
        <View style={styles.undeployedContainer}>
          <Text style={styles.undeployedText}>Not deployed yet</Text>
          <Text style={styles.undeployedHint}>
            Deploy your passkey-secured smart account below
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="shield" size={20} color={smartAccountDeployed ? '#10b981' : '#f59e0b'} />
        <Text style={styles.title}>Smart Account</Text>
        <View style={styles.statusBadge}>
          <Text style={[styles.statusText, smartAccountDeployed && styles.statusDeployed]}>
            {smartAccountDeployed ? '✅ Deployed' : '⏳ Predicted'}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.addressButton}
        onPress={handleCopyAddress}
        activeOpacity={0.7}
      >
        <View style={styles.addressContent}>
          <View style={styles.addressTextContainer}>
            <Text style={styles.addressLabel}>Address</Text>
            <Text style={styles.addressText} numberOfLines={1}>
              {smartAccountAddress.slice(0, 10)}...{smartAccountAddress.slice(-8)}
            </Text>
          </View>
          <Feather name="copy" size={18} color="#007AFF" />
        </View>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Feather name="info" size={14} color="#666" />
        <Text style={styles.infoText}>
          {smartAccountDeployed 
            ? 'Tap to copy your smart account address' 
            : 'This is the predicted address. Deploy to activate it.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statusDeployed: {
    color: '#10b981',
  },
  undeployedContainer: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    alignItems: 'center',
  },
  undeployedText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  undeployedHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  addressButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  addressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 6,
    flex: 1,
  },
});
