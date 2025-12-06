/**
 * AA Wallet Debug Screen
 * 
 * Comprehensive testing and verification UI for Account Abstraction wallet
 * Allows developers/testers to verify implementation without manual testing
 */

import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ethers } from "ethers";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { getBundlerUrl, getPaymasterUrl, getRpcUrl } from "@/src/core/network/chain";
import { areContractsReady, getContractAddresses, validateContractAddresses } from "@/src/core/network/contracts";
import { getAAWalletService } from "@/src/features/wallet/services/AAWalletService";
import { getSupabaseWalletService } from "@/src/features/wallet/services/SupabaseWalletService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
  data?: any;
}

export default function AAWalletDebugScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { theme } = useAppTheme();
  
  // Defensive check for theme
  if (!theme || !theme.colors) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
        <Text style={{ color: '#ff6b6b', fontSize: 16 }}>Error: Theme not initialized</Text>
      </View>
    );
  }
  
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const user = useUserStore((state) => state?.user);
  const aaAccount = useWalletStore((state) => state?.aaAccount);
  const activeAccount = useWalletStore((state) => state?.activeAccount);
  const deploymentStatus = useWalletStore((state) => state?.accountDeploymentStatus);
  
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Infrastructure Check', status: 'idle' },
    { name: 'Contract Addresses', status: 'idle' },
    { name: 'Predict Address', status: 'idle' },
    { name: 'Check Deployment', status: 'idle' },
    { name: 'Database Connection', status: 'idle' },
    { name: 'EOA Balance', status: 'idle' },
    { name: 'Bundler Connection', status: 'idle' },
    { name: 'Paymaster Connection', status: 'idle' },
  ]);
  
  const [autoRunning, setAutoRunning] = useState(false);
  
  const updateTest = useCallback((index: number, updates: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) => i === index ? { ...test, ...updates } : test));
  }, []);
  
  // Test 1: Infrastructure Check
  const testInfrastructure = useCallback(async () => {
    updateTest(0, { status: 'running' });
    try {
      const rpcUrl = getRpcUrl();
      const bundlerUrl = getBundlerUrl();
      const paymasterUrl = getPaymasterUrl();
      
      updateTest(0, {
        status: 'success',
        message: 'All URLs configured',
        data: { rpcUrl, bundlerUrl, paymasterUrl }
      });
    } catch (error) {
      updateTest(0, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Infrastructure check failed'
      });
    }
  }, [updateTest]);
  
  // Test 2: Contract Addresses
  const testContracts = useCallback(async () => {
    updateTest(1, { status: 'running' });
    try {
      const contracts = getContractAddresses(31337);
      if (!contracts) {
        updateTest(1, {
          status: 'error',
          message: 'Failed to get contract addresses'
        });
        return;
      }
      
      const isValid = validateContractAddresses(contracts);
      const isReady = await areContractsReady(31337);
      
      if (!isReady) {
        updateTest(1, {
          status: 'error',
          message: '⚠️ Contracts not deployed yet - addresses are placeholder 0x000...',
          data: contracts
        });
      } else if (!isValid) {
        updateTest(1, {
          status: 'error',
          message: 'Invalid contract addresses',
          data: contracts
        });
      } else {
        updateTest(1, {
          status: 'success',
          message: 'All contracts configured',
          data: contracts
        });
      }
    } catch (error) {
      updateTest(1, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Contract check failed'
      });
    }
  }, [updateTest]);
  
  // Test 3: Predict Address
  const testPredictAddress = useCallback(async () => {
    if (!user?.id || !activeAccount) {
      updateTest(2, { status: 'error', message: 'No user or active account' });
      return;
    }
    
    updateTest(2, { status: 'running' });
    try {
      const aaService = getAAWalletService();
      const predictedAddress = await aaService.predictAccountAddress({
        userId: user.id,
        ownerAddress: activeAccount.address,
        chainId: 31337
      });
      
      updateTest(2, {
        status: 'success',
        message: 'Address predicted successfully',
        data: { predictedAddress }
      });
    } catch (error) {
      updateTest(2, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Prediction failed'
      });
    }
  }, [user, activeAccount, updateTest]);
  
  // Test 4: Check Deployment
  const testCheckDeployment = useCallback(async () => {
    if (!aaAccount?.predictedAddress) {
      updateTest(3, { status: 'error', message: 'No AA account to check' });
      return;
    }
    
    updateTest(3, { status: 'running' });
    try {
      const aaService = getAAWalletService();
      const isDeployed = await aaService.isAccountDeployed(aaAccount.predictedAddress);
      
      updateTest(3, {
        status: isDeployed ? 'success' : 'idle',
        message: isDeployed ? 'Account is deployed on-chain' : 'Account not yet deployed',
        data: { address: aaAccount.predictedAddress, isDeployed }
      });
    } catch (error) {
      updateTest(3, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Deployment check failed'
      });
    }
  }, [aaAccount, updateTest]);
  
  // Test 5: Database Connection
  const testDatabase = useCallback(async () => {
    if (!user?.id) {
      updateTest(4, { status: 'error', message: 'No user logged in' });
      return;
    }
    
    updateTest(4, { status: 'running' });
    try {
      const supabaseService = getSupabaseWalletService();
      const wallet = await supabaseService.getAAWallet(user.id);
      const passkeys = await supabaseService.getPasskeys(user.id);
      
      updateTest(4, {
        status: 'success',
        message: `Found ${wallet ? '1 wallet' : 'no wallet'}, ${passkeys?.length || 0} passkeys`,
        data: { 
          wallet: wallet || null, 
          passkeys: passkeys || [],
          passkeyCount: passkeys?.length || 0
        }
      });
    } catch (error) {
      updateTest(4, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Database query failed'
      });
    }
  }, [user, updateTest]);
  
  // Test 6: EOA Balance
  const testEOABalance = useCallback(async () => {
    if (!activeAccount) {
      updateTest(5, { status: 'error', message: 'No active account' });
      return;
    }
    
    updateTest(5, { status: 'running' });
    try {
      const provider = new ethers.JsonRpcProvider(getRpcUrl());
      const balance = await provider.getBalance(activeAccount.address);
      const balanceEth = ethers.formatEther(balance);
      
      updateTest(5, {
        status: 'success',
        message: `Balance: ${parseFloat(balanceEth).toFixed(4)} ETH`,
        data: { address: activeAccount.address, balance: balanceEth }
      });
    } catch (error) {
      updateTest(5, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Balance fetch failed'
      });
    }
  }, [activeAccount, updateTest]);
  
  // Test 7: Bundler Connection
  const testBundler = useCallback(async () => {
    updateTest(6, { status: 'running' });
    try {
      const bundlerProvider = new ethers.JsonRpcProvider(getBundlerUrl());
      const network = await bundlerProvider.getNetwork();
      
      updateTest(6, {
        status: 'success',
        message: `Connected to bundler (chainId: ${network.chainId})`,
        data: { chainId: network.chainId.toString() }
      });
    } catch (error) {
      updateTest(6, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Bundler connection failed'
      });
    }
  }, [updateTest]);
  
  // Test 8: Paymaster Connection
  const testPaymaster = useCallback(async () => {
    updateTest(7, { status: 'running' });
    try {
      const paymasterUrl = getPaymasterUrl();
      const response = await fetch(paymasterUrl + '/health', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        updateTest(7, {
          status: 'success',
          message: 'Paymaster is healthy',
          data: { url: paymasterUrl }
        });
      } else {
        updateTest(7, {
          status: 'idle',
          message: 'Paymaster health check endpoint not available',
          data: { url: paymasterUrl }
        });
      }
    } catch (error) {
      updateTest(7, {
        status: 'idle',
        message: 'Paymaster endpoint check failed (this is okay)',
        data: { note: 'Paymaster will be tested during actual deployment' }
      });
    }
  }, [updateTest]);
  
  // Run all tests
  const runAllTests = useCallback(async () => {
    setAutoRunning(true);
    await testInfrastructure();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testContracts();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testPredictAddress();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testCheckDeployment();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testDatabase();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testEOABalance();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testBundler();
    await new Promise(resolve => setTimeout(resolve, 500));
    await testPaymaster();
    setAutoRunning(false);
  }, [testInfrastructure, testContracts, testPredictAddress, testCheckDeployment, testDatabase, testEOABalance, testBundler, testPaymaster]);
  
  // Quick actions
  const handleDeployAccount = useCallback(() => {
    navigation.navigate('DeployAccount');
  }, [navigation]);
  
  const handleViewDatabase = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user logged in');
      return;
    }
    
    try {
      const supabaseService = getSupabaseWalletService();
      const wallet = await supabaseService.getAAWallet(user.id);
      const passkeys = await supabaseService.getPasskeys(user.id);
      const guardians = wallet ? await supabaseService.getGuardians(wallet.id) : [];
      const transactions = wallet ? await supabaseService.getTransactions(wallet.id, 10) : [];
      
      Alert.alert('Database Data', JSON.stringify({
        wallet: wallet ? {
          id: wallet.id,
          predicted_address: wallet.predicted_address,
          is_deployed: wallet.is_deployed,
          deployment_tx_hash: wallet.deployment_tx_hash
        } : null,
        passkeys: passkeys.length,
        guardians: guardians.length,
        transactions: transactions.length
      }, null, 2));
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to fetch database data');
    }
  }, [user]);
  
  const handleClearStore = useCallback(() => {
    Alert.alert(
      'Clear Store',
      'This will reset the wallet store. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            useWalletStore.getState().reset();
            Alert.alert('Success', 'Store cleared');
          }
        }
      ]
    );
  }, []);
  
  const testFunctions = [
    testInfrastructure,
    testContracts,
    testPredictAddress,
    testCheckDeployment,
    testDatabase,
    testEOABalance,
    testBundler,
    testPaymaster
  ];
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>AA Wallet Debug</Text>
        <TouchableOpacity onPress={runAllTests} disabled={autoRunning} style={styles.runAllButton}>
          {autoRunning ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Feather name="play" size={18} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Current State */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current State</Text>
          
          <View style={styles.stateCard}>
            <View style={styles.stateRow}>
              <Text style={styles.stateLabel}>User ID:</Text>
              <Text style={styles.stateValue}>{user?.id ? `${user.id.slice(0, 8)}...` : 'Not logged in'}</Text>
            </View>
            
            <View style={styles.stateRow}>
              <Text style={styles.stateLabel}>Active Account:</Text>
              <Text style={styles.stateValue}>
                {activeAccount ? `${activeAccount.address.slice(0, 8)}...${activeAccount.address.slice(-6)}` : 'None'}
              </Text>
            </View>
            
            <View style={styles.stateRow}>
              <Text style={styles.stateLabel}>AA Account:</Text>
              <Text style={styles.stateValue}>
                {aaAccount ? `${aaAccount.predictedAddress.slice(0, 8)}...${aaAccount.predictedAddress.slice(-6)}` : 'Not created'}
              </Text>
            </View>
            
            <View style={styles.stateRow}>
              <Text style={styles.stateLabel}>Deployed:</Text>
              <View style={[styles.statusBadge, aaAccount?.isDeployed ? styles.statusSuccess : styles.statusWarning]}>
                <Text style={[styles.statusText, { color: aaAccount?.isDeployed ? colors.success : colors.warning }]}>
                  {aaAccount?.isDeployed ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>
            
            <View style={styles.stateRow}>
              <Text style={styles.stateLabel}>Deployment Status:</Text>
              <Text style={styles.stateValue}>{deploymentStatus}</Text>
            </View>
          </View>
        </View>
        
        {/* Tests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnostic Tests</Text>
          
          {tests.map((test, index) => (
            <TouchableOpacity
              key={test.name}
              style={styles.testCard}
              onPress={() => testFunctions[index]()}
              disabled={test.status === 'running' || autoRunning}
            >
              <View style={styles.testHeader}>
                <Text style={styles.testName}>{test.name}</Text>
                {test.status === 'idle' && <Feather name="circle" size={16} color={colors.textMuted} />}
                {test.status === 'running' && <ActivityIndicator size="small" color={colors.accent} />}
                {test.status === 'success' && <Feather name="check-circle" size={16} color={colors.success} />}
                {test.status === 'error' && <Feather name="x-circle" size={16} color={colors.danger} />}
              </View>
              
              {test.message && (
                <Text style={[styles.testMessage, test.status === 'error' && { color: colors.danger }]}>
                  {test.message}
                </Text>
              )}
              
              {test.data && test.status === 'success' && (
                <View style={styles.testData}>
                  <Text style={styles.testDataText} numberOfLines={3}>
                    {(() => {
                      try {
                        return JSON.stringify(test.data, null, 2);
                      } catch (e) {
                        return 'Data available (cannot display)';
                      }
                    })()}
                  </Text>
                </View>
              )}
              
              {test.data && test.status === 'error' && (
                <View style={styles.testData}>
                  <Text style={[styles.testDataText, { color: colors.danger }]} numberOfLines={3}>
                    {(() => {
                      try {
                        return JSON.stringify(test.data, null, 2);
                      } catch (e) {
                        return 'Error data available';
                      }
                    })()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleDeployAccount}>
            <Feather name="zap" size={18} color={colors.accent} />
            <Text style={styles.actionButtonText}>Deploy Account</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleViewDatabase}>
            <Feather name="database" size={18} color={colors.accent} />
            <Text style={styles.actionButtonText}>View Database Data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleClearStore}>
            <Feather name="trash-2" size={18} color={colors.danger} />
            <Text style={[styles.actionButtonText, { color: colors.danger }]}>Clear Store</Text>
          </TouchableOpacity>
        </View>
        
        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Test</Text>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>1. Check Infrastructure</Text>
            <Text style={styles.instructionText}>
              Verify RPC, bundler, and paymaster URLs are configured
            </Text>
          </View>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>2. Check Contracts</Text>
            <Text style={styles.instructionText}>
              ⚠️ If this fails, contracts need to be deployed using Foundry
            </Text>
          </View>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>3. Run All Tests</Text>
            <Text style={styles.instructionText}>
              Tap the play button (▶️) at top right to run all diagnostic tests
            </Text>
          </View>
          
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>4. Deploy Account</Text>
            <Text style={styles.instructionText}>
              Once contracts are deployed, use "Deploy Account" to test the full flow
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
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    stateCard: {
      backgroundColor: withAlpha(colors.surfaceElevated, 0.5),
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.4),
      gap: 12,
    },
    stateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    stateLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    stateValue: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '600',
      fontFamily: 'monospace',
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusSuccess: {
      backgroundColor: withAlpha(colors.success, 0.15),
    },
    statusWarning: {
      backgroundColor: withAlpha(colors.warning, 0.15),
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    testCard: {
      backgroundColor: withAlpha(colors.surfaceElevated, 0.4),
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.4),
      marginBottom: 10,
    },
    testHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    testName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    testMessage: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    testData: {
      marginTop: 8,
      padding: 10,
      backgroundColor: withAlpha(colors.background, 0.5),
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.3),
    },
    testDataText: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: 'monospace',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: withAlpha(colors.accent, 0.12),
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.3),
      marginBottom: 10,
    },
    actionButtonDanger: {
      backgroundColor: withAlpha(colors.danger, 0.08),
      borderColor: withAlpha(colors.danger, 0.3),
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
    instructionCard: {
      backgroundColor: withAlpha(colors.surfaceElevated, 0.3),
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.3),
      marginBottom: 10,
    },
    instructionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
    },
    instructionText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
