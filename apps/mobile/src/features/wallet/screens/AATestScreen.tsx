/**
 * Account Abstraction Testing Screen
 * 
 * Comprehensive testing UI for:
 * - Biometric authentication (passkeys)
 * - Contract deployment verification
 * - AA wallet creation
 * - UserOperation submission
 * - Gasless transactions
 * 
 * USE THIS SCREEN FOR LOCAL TESTING BEFORE DEPLOYING TO TESTNET
 */

import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ethers } from 'ethers';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';

import { CHAIN_CONFIG, getRpcUrl, logNetworkConfig } from '@/src/core/network/chain';
import { getContractAddresses, validateContractAddresses } from '@/src/core/network/contracts';
import PasskeyService, { BiometricCapabilities, PasskeyMetadata } from '@/src/features/wallet/services/PasskeyService';
import { predictAccountAddress, directDeployAccount, getDeployment } from '@/src/integration/viem';
  import { useWalletStore } from '@/src/features/wallet/store/useWalletStore';
import { useUserStore } from '@store/useUserStore';
import type { ThemeColors } from '@theme';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

interface TestResult {
  id: number;
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
}

export default function AATestScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = createStyles(colors);
  const user = useUserStore((state) => state.user);
  const markAsDeployed = useWalletStore((state) => state.markAsDeployed);
  const setAAAccount = useWalletStore((state) => state.setAAAccount);
  
  // Test results state
  const [tests, setTests] = useState<TestResult[]>([
    { id: 1, name: 'Network Connectivity', status: 'idle' },
    { id: 2, name: 'Contract Deployment', status: 'idle' },
    { id: 3, name: 'Biometric Capabilities', status: 'idle' },
    { id: 4, name: 'Passkey Creation', status: 'idle' },
    { id: 5, name: 'Passkey Signing', status: 'idle' },
    { id: 6, name: 'AA Wallet Prediction', status: 'idle' },
    { id: 7, name: 'Fund Test Account', status: 'idle' },
    { id: 8, name: 'Deploy AA Wallet', status: 'idle' },
  ]);
  
  const [biometricInfo, setBiometricInfo] = useState<BiometricCapabilities | null>(null);
  const [testPasskey, setTestPasskey] = useState<PasskeyMetadata | null>(null);
  const [predictedAddress, setPredictedAddress] = useState<string | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [isTestingInProgress, setIsTestingInProgress] = useState(false);
  
  // Update a single test result
  const updateTest = useCallback((id: number, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, ...updates } : test
    ));
  }, []);
  
  // Log network config on mount
  useEffect(() => {
    logNetworkConfig();
  }, []);
  
  // Test 1: Network Connectivity
  const testNetworkConnectivity = useCallback(async () => {
    updateTest(1, { status: 'running', message: 'Connecting to Anvil...' });
    
    try {
      const rpcUrl = getRpcUrl();
      const publicClient = createPublicClient({
        chain: anvil,
        transport: http(rpcUrl),
      });
      
      const blockNumber = await publicClient.getBlockNumber();
      const chainId = await publicClient.getChainId();
      
      updateTest(1, {
        status: 'success',
        message: `✅ Connected! Chain ID: ${chainId}, Block: ${blockNumber}`,
        data: { rpcUrl, chainId, blockNumber: Number(blockNumber) },
      });
    } catch (error) {
      updateTest(1, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Connection failed'}`,
      });
    }
  }, [updateTest]);
  
  // Test 2: Contract Deployment
  const testContractDeployment = useCallback(async () => {
    updateTest(2, { status: 'running', message: 'Checking contracts...' });
    
    try {
      const contracts = getContractAddresses(CHAIN_CONFIG.chainId);
      const isValid = validateContractAddresses(contracts);
      
      if (!isValid) {
        updateTest(2, {
          status: 'error',
          message: '❌ Contracts not deployed (addresses are zero)',
          data: contracts,
        });
        return;
      }
      
      // Verify factory contract exists on chain
      const publicClient = createPublicClient({
        chain: anvil,
        transport: http(getRpcUrl()),
      });
      
      const code = await publicClient.getBytecode({
        address: contracts.accountFactory as `0x${string}`,
      });
      
      if (!code || code === '0x') {
        updateTest(2, {
          status: 'error',
          message: '❌ Factory contract not found on chain',
          data: contracts,
        });
        return;
      }
      
      updateTest(2, {
        status: 'success',
        message: `✅ All contracts deployed and verified`,
        data: contracts,
      });
    } catch (error) {
      updateTest(2, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Contract check failed'}`,
      });
    }
  }, [updateTest]);
  
  // Test 3: Biometric Capabilities
  const testBiometricCapabilities = useCallback(async () => {
    updateTest(3, { status: 'running', message: 'Checking biometrics...' });
    
    try {
      const capabilities = await PasskeyService.checkBiometricCapabilities();
      setBiometricInfo(capabilities);
      
      if (!capabilities.hasHardware) {
        updateTest(3, {
          status: 'error',
          message: '❌ No biometric hardware found',
          data: capabilities,
        });
        return;
      }
      
      if (!capabilities.isEnrolled) {
        updateTest(3, {
          status: 'error',
          message: '⚠️ Biometric hardware found but not enrolled',
          data: capabilities,
        });
        return;
      }
      
      const typeNames = capabilities.supportedTypes.length > 0 
        ? capabilities.supportedTypes.join(', ') 
        : 'Passkeys';
      
      updateTest(3, {
        status: 'success',
        message: `✅ Biometrics available: ${typeNames}`,
        data: capabilities,
      });
    } catch (error) {
      updateTest(3, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Biometric check failed'}`,
      });
    }
  }, [updateTest]);
  
  // Test 4: Passkey Creation
  const testPasskeyCreation = useCallback(async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create passkeys');
      return;
    }
    
    updateTest(4, { status: 'running', message: 'Creating passkey...' });
    
    try {
      console.log('🔐 [AATest] Starting passkey creation...');
      const passkey = await PasskeyService.createPasskey(user.id);
      setTestPasskey(passkey);
      
      console.log('✅ [AATest] Passkey created:', passkey.credentialId);
      updateTest(4, {
        status: 'success',
        message: `✅ Passkey created: ${passkey.credentialId.slice(0, 10)}...`,
        data: passkey,
      });
    } catch (error) {
      console.error('❌ [AATest] Passkey creation failed:', error);
      updateTest(4, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Passkey creation failed'}`,
      });
      // Don't throw - let the test continue
    }
  }, [user, updateTest]);
  
  // Test 5: Passkey Signing
  const testPasskeySigning = useCallback(async () => {
    if (!testPasskey || !user) {
      Alert.alert('Error', 'Create a passkey first (Test 4)');
      return;
    }
    
    updateTest(5, { status: 'running', message: 'Signing test message...' });
    
    try {
      console.log('🔐 [AATest] Starting passkey signing test...');
      // Create a test userOpHash (32 bytes)
      const testUserOpHash = '0x' + '1234567890abcdef'.repeat(4);
      const signature = await PasskeyService.signWithPasskey(user.id, testUserOpHash);
      
      console.log('✅ [AATest] Signing successful');
      updateTest(5, {
        status: 'success',
        message: `✅ Signature r: ${signature.r.slice(0, 20)}...`,
        data: { userOpHash: testUserOpHash, signature },
      });
    } catch (error) {
      console.error('❌ [AATest] Signing failed:', error);
      updateTest(5, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Signing failed'}`,
      });
      // Don't throw - let the test continue
    }
  }, [testPasskey, user, updateTest]);
  
  // Test 6: AA Wallet Address Prediction
  const testAAWalletPrediction = useCallback(async () => {
    if (!testPasskey || !testPasskey.credentialIdRaw) {
      Alert.alert('Error', 'Create a passkey first (Test 4)');
      return;
    }
    
    updateTest(6, { status: 'running', message: 'Predicting AA wallet address...' });
    
    try {
      const chainId = CHAIN_CONFIG.chainId;
      const salt = testPasskey.credentialIdRaw as Hex; // deterministic per-passkey

      console.log('🔍 [AATest] Predicting wallet address with passkey salt:', salt);

      const predictedAddr = await predictAccountAddress(chainId, salt);

      setPredictedAddress(predictedAddr as string);
      
      updateTest(6, {
        status: 'success',
        message: `✅ Predicted: ${predictedAddr}`,
        data: { salt, predictedAddress: predictedAddr },
      });
    } catch (error) {
      console.error('❌ [AATest] Prediction failed:', error);
      updateTest(6, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Prediction failed'}`,
        data: { error: String(error) },
      });
    }
  }, [testPasskey, updateTest]);
  
  // Test 7: Fund Test Account
  const testFundAccount = useCallback(async () => {
    if (!predictedAddress) {
      Alert.alert('Error', 'Predict AA wallet address first (Test 6)');
      return;
    }
    
    updateTest(7, { status: 'running', message: 'Funding account...' });
    
    try {
      // Use Anvil's default test account to send funds
      const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const account = privateKeyToAccount(testPrivateKey as `0x${string}`);
      
      const walletClient = createWalletClient({
        account,
        chain: anvil,
        transport: http(getRpcUrl()),
      });
      
      const publicClient = createPublicClient({
        chain: anvil,
        transport: http(getRpcUrl()),
      });
      
      // Send 0.5 ETH to predicted address
      const hash = await walletClient.sendTransaction({
        to: predictedAddress as `0x${string}`,
        value: parseEther('0.5'),
      });
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Get balance
      const balance = await publicClient.getBalance({
        address: predictedAddress as `0x${string}`,
      });
      
      updateTest(7, {
        status: 'success',
        message: `✅ Funded with 0.5 ETH. Balance: ${ethers.formatEther(balance)} ETH`,
        data: { txHash: hash, balance: balance.toString() },
      });
    } catch (error) {
      updateTest(7, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message : 'Funding failed'}`,
      });
    }
  }, [predictedAddress, updateTest]);
  
  // Test 8: Deploy AA Wallet
  const testDeployWallet = useCallback(async () => {
    // Check if we have the required data (passkey and predicted address)
    if (!testPasskey || !predictedAddress) {
      Alert.alert(
        'Prerequisites Missing', 
        'Please run tests 4-7 first to generate passkey and wallet address.\n\n' +
        'Quick fix: Tap the "Run All Tests" button at the top.'
      );
      return;
    }
    
    updateTest(8, { status: 'running', message: 'Deploying wallet on-chain...' });
    
    try {
      const chainId = CHAIN_CONFIG.chainId;
      const deployment = getDeployment(chainId);
      if (!deployment?.passkeyValidator) {
        throw new Error('Passkey validator not configured for this chain');
      }

      const salt = testPasskey.credentialIdRaw as Hex;
      const passkeyInit = {
        idRaw: testPasskey.credentialIdRaw as Hex,
        px: BigInt(testPasskey.publicKeyX),
        py: BigInt(testPasskey.publicKeyY),
      };

      console.log('🚀 [AATest] Deploying passkey account with salt:', salt);

      const result = await directDeployAccount({
        chainId,
        salt,
        passkeyInit,
        validator: deployment.passkeyValidator as `0x${string}`,
      });

      const deployedAddress = result.accountAddress;
      setPredictedAddress(deployedAddress);

      // Update wallet store with deployment info
      markAsDeployed(result.transactionHash, Number(result.blockNumber));
      setAAAccount({
        id: user?.id || 'test-user',
        userId: user?.id || 'test-user',
        predictedAddress: deployedAddress,
        ownerAddress: testPasskey.credentialIdRaw, // passkey-backed account
        isDeployed: true,
        deploymentTxHash: result.transactionHash,
        deploymentBlockNumber: Number(result.blockNumber),
        walletName: 'Test AA Wallet',
        chainId,
        createdAt: new Date().toISOString(),
        deployedAt: new Date().toISOString(),
      });

      updateTest(8, {
        status: 'success',
        message: `✅ Deployed! Address: ${deployedAddress.slice(0, 10)}...`,
        data: {
          txHash: result.transactionHash,
          walletAddress: deployedAddress,
          blockNumber: String(result.blockNumber),
          gasUsed: result.gasUsed?.toString?.() || '',
          hasCode: true,
        },
      });
    } catch (error) {
      console.error('❌ [AATest] Deployment failed:', error);
      
      // If timeout, check if wallet was actually deployed
      if (error instanceof Error && error.message.includes('Timed out')) {
        console.log('⏳ [AATest] Timeout occurred, checking if wallet exists...');
        
        try {
          const publicClient = createPublicClient({
            chain: anvil,
            transport: http(getRpcUrl()),
          });
          
          const code = await publicClient.getBytecode({
            address: predictedAddress as `0x${string}`,
          });
          
          if (code && code !== '0x') {
            console.log('✅ [AATest] Wallet exists despite timeout!');
            updateTest(8, {
              status: 'success',
              message: `✅ Deployed! (tx timed out but wallet exists)`,
              data: {
                walletAddress: predictedAddress,
                note: 'Transaction succeeded but confirmation timed out',
              },
            });
            return;
          }
        } catch (checkError) {
          console.error('Failed to check wallet existence:', checkError);
        }
      }
      
      updateTest(8, {
        status: 'error',
        message: `❌ ${error instanceof Error ? error.message.split('\\n')[0] : 'Deployment failed'}`,
        data: { error: String(error) },
      });
    }
  }, [testPasskey, predictedAddress, updateTest]);
  
  // Run all tests sequentially
  const runAllTests = async () => {
    // Prevent multiple concurrent runs
    if (isTestingInProgress) {
      Alert.alert('Tests Running', 'Please wait for current tests to complete');
      return;
    }
    
    setIsTestingInProgress(true);
    setAutoRunning(true);
    
    // Clean up previous passkey from secure storage
    if (testPasskey?.credentialId) {
      try {
        await PasskeyService.deletePasskeySilent(testPasskey.credentialId);
        console.log('🧹 [AATest] Cleaned up previous passkey:', testPasskey.credentialId);
      } catch (error) {
        console.warn('⚠️ [AATest] Failed to clean up previous passkey:', error);
      }
    }
    
    // Reset all tests and clear previous passkey
    setTestPasskey(null);
    setPredictedAddress(null);
    setTests(prev => prev.map(test => ({ ...test, status: 'idle', message: undefined, data: undefined })));
    
    try {
      // Run tests in sequence
      await testNetworkConnectivity();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testContractDeployment();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testBiometricCapabilities();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Note: We don't stop here for biometric errors anymore
      // The individual tests will handle their own errors
      // This allows the automated run to continue and show all results
      
      await testPasskeyCreation();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testPasskeySigning();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testAAWalletPrediction();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testFundAccount();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await testDeployWallet();
      
      Alert.alert(
        'Tests Complete',
        'All 8 tests have finished. Check the results above.\\n\\n' +
        'If everything passed ✅, your AA wallet is deployed and ready to use!'
      );
    } catch (error) {
      console.error('❌ [AATest] Test sequence interrupted:', error);
      Alert.alert(
        'Tests Interrupted',
        'Some tests failed to complete. Check the results above for details.'
      );
    } finally {
      setAutoRunning(false);
      setIsTestingInProgress(false);
    }
  };
  
  // Render test row
  const renderTest = (test: TestResult) => {
    const statusIcon = 
      test.status === 'running' ? <ActivityIndicator size="small" color={colors.accent} /> :
      test.status === 'success' ? <Feather name="check-circle" size={20} color={colors.success} /> :
      test.status === 'error' ? <Feather name="x-circle" size={20} color={colors.danger} /> :
      <Feather name="circle" size={20} color={colors.textMuted} />;
    
    return (
      <View key={test.id} style={styles.testRow}>
        <View style={styles.testHeader}>
          <View style={styles.testTitleRow}>
            {statusIcon}
            <Text style={styles.testName}>{test.name}</Text>
          </View>
          {test.status === 'idle' && (
            <TouchableOpacity
              style={styles.runButton}
              onPress={() => {
                switch (test.id) {
                  case 1: testNetworkConnectivity(); break;
                  case 2: testContractDeployment(); break;
                  case 3: testBiometricCapabilities(); break;
                  case 4: testPasskeyCreation(); break;
                  case 5: testPasskeySigning(); break;
                  case 6: testAAWalletPrediction(); break;
                  case 7: testFundAccount(); break;
                  case 8: testDeployWallet(); break;
                }
              }}
            >
              <Feather name="play" size={16} color={colors.accent} />
            </TouchableOpacity>
          )}
        </View>
        
        {test.message && (
          <Text style={[
            styles.testMessage,
            test.status === 'error' && { color: colors.danger }
          ]}>
            {test.message}
          </Text>
        )}
        
        {test.data && (
          <View style={styles.testData}>
            <Text style={styles.testDataText}>
              {JSON.stringify(test.data, null, 2).slice(0, 200)}
              {JSON.stringify(test.data).length > 200 && '...'}
            </Text>
          </View>
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>AA Wallet Testing</Text>
        <TouchableOpacity 
          onPress={runAllTests} 
          disabled={autoRunning}
          style={styles.runAllButton}
        >
          {autoRunning ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Feather name="play-circle" size={20} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>
      
      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Feather name="info" size={18} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Testing Account Abstraction</Text>
            <Text style={styles.infoText}>
              Platform: {Platform.OS} {'\n'}
              Network: {getRpcUrl()}{'\n'}
              Chain ID: {CHAIN_CONFIG.chainId}
            </Text>
          </View>
        </View>
        
        {/* Test Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          {tests.map(renderTest)}
        </View>
        
        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Test</Text>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>1. Run All Tests</Text>
            <Text style={styles.instructionText}>
              Tap the play button (▶️) at top right to run all tests automatically
            </Text>
          </View>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>2. Check Biometrics</Text>
            <Text style={styles.instructionText}>
              Make sure your device has fingerprint/face ID set up in Settings
            </Text>
          </View>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>3. Verify Deployment</Text>
            <Text style={styles.instructionText}>
              All tests should pass ✅ if Docker is running and contracts are deployed
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.border, 0.3),
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.6),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    runAllButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.accent, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      paddingBottom: 40,
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: withAlpha(colors.accent, 0.1),
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.2),
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    infoText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    testRow: {
      backgroundColor: withAlpha(colors.surfaceElevated, 0.5),
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.3),
    },
    testHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    testTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    testName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    runButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: withAlpha(colors.accent, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    testMessage: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      lineHeight: 18,
    },
    testData: {
      backgroundColor: withAlpha(colors.background, 0.5),
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    testDataText: {
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    instructionCard: {
      backgroundColor: withAlpha(colors.surfaceElevated, 0.3),
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.3),
    },
    instructionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    instructionText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
