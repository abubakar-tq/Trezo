import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { PasskeyService } from '../services/PasskeyService';
import { directDeployAccount, predictAccountAddress, isAccountDeployed } from '../../../integration/viem';
import type { Hex } from 'viem';
import { useUserStore } from '@store/useUserStore';

export const DirectDeployCard = () => {
  const [loading, setLoading] = useState(false);
  
  const authUser = useUserStore((state) => state.user);
  const userId = authUser?.id ?? null;
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const setSmartAccountAddress = useUserStore((state) => state.setSmartAccountAddress);
  const setSmartAccountDeployed = useUserStore((state) => state.setSmartAccountDeployed);

  const handleDirectDeploy = async () => {
    try {
      setLoading(true);
      console.log('[DirectDeployCard] Starting direct deployment...');

      if (!userId) {
        throw new Error('No authenticated user found. Please sign in first.');
      }

      // Get or create passkey
      let passkey = await PasskeyService.getPasskey(userId);
      
      if (!passkey) {
        console.log('[DirectDeployCard] No passkey found, creating new one...');
        const newPasskey = await PasskeyService.createPasskey(userId);
        if (!newPasskey) {
          throw new Error('Failed to create passkey');
        }
        // Fetch it again to get the stored format
        passkey = await PasskeyService.getPasskey(userId);
        if (!passkey) {
          throw new Error('Failed to retrieve created passkey');
        }
      }

      console.log('[DirectDeployCard] Using passkey:', passkey.credentialId);

      // Ensure coordinates are 32 bytes with 0x prefix
      const pxHex = passkey.publicKeyX.startsWith("0x") ? passkey.publicKeyX : (`0x${passkey.publicKeyX}` as Hex);
      const pyHex = passkey.publicKeyY.startsWith("0x") ? passkey.publicKeyY : (`0x${passkey.publicKeyY}` as Hex);
      
      if (pxHex.length !== 66 || pyHex.length !== 66) {
        throw new Error("Stored passkey public key is invalid. Please delete and recreate your passkey.");
      }

      console.log('[DirectDeployCard] Public key X:', pxHex);
      console.log('[DirectDeployCard] Public key Y:', pyHex);

      // Prepare passkey init
      const passkeyInit = {
        idRaw: passkey.credentialIdRaw as Hex,
        px: BigInt(pxHex),
        py: BigInt(pyHex),
      };

      // Use a deterministic salt based on the passkey ID
      const salt = passkey.credentialIdRaw as Hex;

      // Get validator address from deployment
      const chainId = 31337; // Anvil local chain
      const deployment = require('../../../integration/contracts/deployment.31337.json');
      const validator = deployment.passkeyValidator;

      console.log('[DirectDeployCard] Validator:', validator);
      console.log('[DirectDeployCard] Salt:', salt);

      // Predict the account address
      const predictedAddress = await predictAccountAddress(chainId, salt);
      console.log('[DirectDeployCard] Predicted account address:', predictedAddress);
      setSmartAccountAddress(predictedAddress);

      // Check if already deployed
      const alreadyDeployed = await isAccountDeployed(chainId, predictedAddress);
      if (alreadyDeployed) {
        console.log('[DirectDeployCard] Account already deployed!');
        setSmartAccountDeployed(true);
        Alert.alert(
          'Already Deployed',
          `Account is already deployed at:\n${predictedAddress}`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Deploy the account
      console.log('[DirectDeployCard] Deploying account...');
      const result = await directDeployAccount({
        chainId,
        salt,
        passkeyInit,
        validator,
      });

      console.log('[DirectDeployCard] Deployment result:', result);

      if (result.success) {
        setSmartAccountAddress(result.accountAddress);
        setSmartAccountDeployed(true);
        
        Alert.alert(
          'Deployment Successful! 🎉',
          `Account deployed at:\n${result.accountAddress}\n\nTransaction: ${result.transactionHash.slice(0, 10)}...\nGas used: ${result.gasUsed.toString()}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[DirectDeployCard] Error:', error);
      Alert.alert(
        'Deployment Failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const checkDeploymentStatus = async () => {
    try {
      if (!userId) {
        Alert.alert('Not Signed In', 'Please sign in first');
        return;
      }

      if (!smartAccountAddress) {
        // Try to predict address first
        const passkey = await PasskeyService.getPasskey(userId);
        if (!passkey) {
          Alert.alert('No Passkey', 'Please deploy an account first');
          return;
        }

        const chainId = 31337;
        const salt = passkey.credentialIdRaw as Hex;
        const predictedAddress = await predictAccountAddress(chainId, salt);
        setSmartAccountAddress(predictedAddress);
        
        const isDeployed = await isAccountDeployed(chainId, predictedAddress);
        setSmartAccountDeployed(isDeployed);
        
        Alert.alert(
          isDeployed ? 'Already Deployed ✅' : 'Not Deployed',
          `Account address: ${predictedAddress}\nStatus: ${isDeployed ? 'Deployed' : 'Not deployed'}`,
          [{ text: 'OK' }]
        );
      } else {
        const chainId = 31337;
        const isDeployed = await isAccountDeployed(chainId, smartAccountAddress as Hex);
        setSmartAccountDeployed(isDeployed);
        
        Alert.alert(
          isDeployed ? 'Already Deployed ✅' : 'Not Deployed',
          `Account address: ${smartAccountAddress}\nStatus: ${isDeployed ? 'Deployed' : 'Not deployed'}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[DirectDeployCard] Check status error:', error);
      Alert.alert('Error', 'Failed to check deployment status');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚀 Direct Account Deployment</Text>
      <Text style={styles.description}>
        Deploy your smart account directly using an EOA (bypasses UserOperation for testing)
      </Text>

      {smartAccountAddress && (
        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>
            {smartAccountDeployed ? '✅ Deployed at:' : '📍 Predicted address:'}
          </Text>
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
            {smartAccountAddress}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleDirectDeploy}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? '⏳ Deploying...' : smartAccountDeployed ? '✅ Account Deployed' : '🚀 Deploy Account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={checkDeploymentStatus}
      >
        <Text style={styles.buttonText}>🔍 Check Deployment Status</Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ℹ️ This method uses Anvil's default EOA to call AccountFactory.createAccount() directly,
          which is faster for testing but doesn't go through the ERC-4337 flow.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  addressContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#5856D6',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
});
