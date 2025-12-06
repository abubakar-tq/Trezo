/**
 * Account Abstraction Wallet Service
 * 
 * Handles ERC-4337 Account Abstraction wallet operations:
 * - Counterfactual address prediction
 * - Account deployment via AccountFactory
 * - UserOperation creation and submission
 * - Bundler communication
 * - Paymaster integration for gasless transactions
 */

import { CHAIN_CONFIG, getBundlerUrl, getPaymasterUrl, getRpcUrl } from '@/src/core/network/chain';
import {
    CONTRACT_ABIS,
    getContractAddresses,
    validateContractAddresses,
} from '@/src/core/network/contracts';
import { ethers } from 'ethers';

// UserOperation structure (ERC-4337)
export interface UserOperation {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  paymasterAndData: string;
  signature: string;
}

export interface AAWalletConfig {
  userId: string;
  ownerAddress: string; // EOA that controls this AA wallet
  chainId: number;
}

export interface PaymasterData {
  paymasterAndData: string;
  preVerificationGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
}

export interface UserOpReceipt {
  userOpHash: string;
  txHash: string;
  blockNumber: number;
  blockHash: string;
  success: boolean;
  actualGasUsed: string;
  actualGasCost: string;
}

export class AAWalletService {
  private provider: ethers.JsonRpcProvider;
  private bundlerProvider: ethers.JsonRpcProvider;
  private chainId: number;
  
  constructor(chainId: number = CHAIN_CONFIG.chainId) {
    this.chainId = chainId;
    const rpcUrl = getRpcUrl();
    const bundlerUrl = getBundlerUrl();
    
    console.log(`🔧 [AAWalletService] Initializing for chain ${chainId}`);
    console.log(`🔧 [AAWalletService] RPC: ${rpcUrl}`);
    console.log(`🔧 [AAWalletService] Bundler: ${bundlerUrl}`);
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.bundlerProvider = new ethers.JsonRpcProvider(bundlerUrl);
  }
  
  /**
   * Predict the counterfactual address for an AA wallet
   * This address can be used before deployment (send funds to it, etc.)
   */
  async predictAccountAddress(config: AAWalletConfig): Promise<string> {
    console.log(`📍 [AAWalletService] Predicting address for user ${config.userId}`);
    
    try {
      const contracts = getContractAddresses(this.chainId);
      
      // Validate contracts are deployed
      if (!validateContractAddresses(contracts)) {
        throw new Error('Smart contracts not deployed yet. Please deploy contracts first.');
      }
      
      // Create salt from userId (deterministic)
      const salt = ethers.keccak256(ethers.toUtf8Bytes(config.userId));
      
      // Create AccountFactory contract instance
      const accountFactory = new ethers.Contract(
        contracts.accountFactory,
        CONTRACT_ABIS.AccountFactory,
        this.provider
      );
      
      // Call predictAccount function
      const predictedAddress = await accountFactory.predictAccount(salt);
      
      console.log(`✅ [AAWalletService] Predicted address: ${predictedAddress}`);
      
      return predictedAddress;
    } catch (error) {
      console.error('❌ [AAWalletService] Error predicting address:', error);
      throw new Error(`Failed to predict account address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Check if an AA wallet is already deployed
   */
  async isAccountDeployed(address: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(address);
      const isDeployed = code !== '0x';
      
      console.log(`🔍 [AAWalletService] Account ${address} deployed: ${isDeployed}`);
      
      return isDeployed;
    } catch (error) {
      console.error('❌ [AAWalletService] Error checking deployment:', error);
      return false;
    }
  }
  
  /**
   * Deploy an AA wallet via AccountFactory
   * Returns the transaction hash
   */
  async deployAccount(
    config: AAWalletConfig,
    signer: ethers.Signer
  ): Promise<{ txHash: string; address: string }> {
    console.log(`🚀 [AAWalletService] Deploying account for user ${config.userId}`);
    
    try {
      const contracts = getContractAddresses(this.chainId);
      
      if (!validateContractAddresses(contracts)) {
        throw new Error('Smart contracts not deployed');
      }
      
      // Create salt from userId
      const salt = ethers.keccak256(ethers.toUtf8Bytes(config.userId));
      
      // Predict address first
      const predictedAddress = await this.predictAccountAddress(config);
      
      // Check if already deployed
      if (await this.isAccountDeployed(predictedAddress)) {
        console.log(`✅ [AAWalletService] Account already deployed at ${predictedAddress}`);
        return { txHash: '', address: predictedAddress };
      }
      
      // Create AccountFactory contract instance with signer
      const accountFactory = new ethers.Contract(
        contracts.accountFactory,
        CONTRACT_ABIS.AccountFactory,
        signer
      );
      
      // Deploy account
      console.log(`📝 [AAWalletService] Sending deployment transaction...`);
      const tx = await accountFactory.createAccount(config.ownerAddress, salt);
      
      console.log(`⏳ [AAWalletService] Waiting for confirmation... (tx: ${tx.hash})`);
      const receipt = await tx.wait();
      
      console.log(`✅ [AAWalletService] Account deployed!`);
      console.log(`   Address: ${predictedAddress}`);
      console.log(`   Tx Hash: ${receipt.hash}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      
      return {
        txHash: receipt.hash,
        address: predictedAddress,
      };
    } catch (error) {
      console.error('❌ [AAWalletService] Deployment failed:', error);
      throw new Error(`Failed to deploy account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Create a UserOperation for ERC-4337
   */
  async createUserOperation(params: {
    sender: string;
    target: string;
    value: bigint;
    data: string;
    signer: ethers.Signer;
  }): Promise<UserOperation> {
    console.log(`📝 [AAWalletService] Creating UserOperation`);
    console.log(`   From: ${params.sender}`);
    console.log(`   To: ${params.target}`);
    console.log(`   Value: ${ethers.formatEther(params.value)} ETH`);
    
    try {
      const contracts = getContractAddresses(this.chainId);
      
      // Get nonce from EntryPoint
      const entryPoint = new ethers.Contract(
        contracts.entryPoint,
        CONTRACT_ABIS.EntryPoint,
        this.provider
      );
      
      const nonce = await entryPoint.getNonce(params.sender, 0);
      
      // Check if account is deployed
      const isDeployed = await this.isAccountDeployed(params.sender);
      
      // If not deployed, include initCode
      let initCode = '0x';
      if (!isDeployed) {
        // InitCode = AccountFactory address + createAccount calldata
        const accountFactory = new ethers.Contract(
          contracts.accountFactory,
          CONTRACT_ABIS.AccountFactory,
          this.provider
        );
        
        const ownerAddress = await params.signer.getAddress();
        const salt = ethers.keccak256(ethers.toUtf8Bytes(params.sender)); // Use sender as salt
        
        const createAccountData = accountFactory.interface.encodeFunctionData(
          'createAccount',
          [ownerAddress, salt]
        );
        
        initCode = ethers.concat([contracts.accountFactory, createAccountData]);
      }
      
      // Encode the call to the target
      const smartAccount = new ethers.Contract(
        params.sender,
        CONTRACT_ABIS.SmartAccount,
        this.provider
      );
      
      const callData = smartAccount.interface.encodeFunctionData('execute', [
        params.target,
        params.value,
        params.data,
      ]);
      
      // Get gas estimates
      const feeData = await this.provider.getFeeData();
      
      const userOp: UserOperation = {
        sender: params.sender,
        nonce: nonce.toString(),
        initCode,
        callData,
        callGasLimit: '100000', // Will be estimated
        verificationGasLimit: '500000',
        preVerificationGas: '50000',
        maxFeePerGas: feeData.maxFeePerGas?.toString() || '1000000000',
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '1000000000',
        paymasterAndData: '0x', // Will be filled by paymaster
        signature: '0x', // Will be signed later
      };
      
      console.log(`✅ [AAWalletService] UserOperation created`);
      
      return userOp;
    } catch (error) {
      console.error('❌ [AAWalletService] Error creating UserOp:', error);
      throw new Error(`Failed to create UserOperation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get paymaster data for gasless transaction
   */
  async getPaymasterData(userOp: UserOperation): Promise<PaymasterData> {
    console.log(`💰 [AAWalletService] Requesting paymaster sponsorship`);
    
    try {
      const paymasterUrl = getPaymasterUrl();
      
      // Call paymaster service
      const response = await fetch(paymasterUrl + '/sponsor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userOp }),
      });
      
      if (!response.ok) {
        throw new Error(`Paymaster request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log(`✅ [AAWalletService] Paymaster approved gasless transaction`);
      
      return {
        paymasterAndData: data.paymasterAndData,
        preVerificationGas: data.preVerificationGas || userOp.preVerificationGas,
        verificationGasLimit: data.verificationGasLimit || userOp.verificationGasLimit,
        callGasLimit: data.callGasLimit || userOp.callGasLimit,
      };
    } catch (error) {
      console.warn('⚠️  [AAWalletService] Paymaster unavailable, user will pay gas:', error);
      
      // Return empty paymaster data (user pays gas)
      return {
        paymasterAndData: '0x',
        preVerificationGas: userOp.preVerificationGas,
        verificationGasLimit: userOp.verificationGasLimit,
        callGasLimit: userOp.callGasLimit,
      };
    }
  }
  
  /**
   * Sign a UserOperation with the EOA signer
   */
  async signUserOperation(userOp: UserOperation, signer: ethers.Signer): Promise<string> {
    console.log(`✍️  [AAWalletService] Signing UserOperation`);
    
    try {
      const contracts = getContractAddresses(this.chainId);
      
      // Get userOpHash from EntryPoint
      const entryPoint = new ethers.Contract(
        contracts.entryPoint,
        CONTRACT_ABIS.EntryPoint,
        this.provider
      );
      
      const userOpHash = await entryPoint.getUserOpHash(userOp);
      
      // Sign the hash
      const signature = await signer.signMessage(ethers.getBytes(userOpHash));
      
      console.log(`✅ [AAWalletService] UserOperation signed`);
      
      return signature;
    } catch (error) {
      console.error('❌ [AAWalletService] Error signing UserOp:', error);
      throw new Error(`Failed to sign UserOperation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Submit UserOperation to bundler
   */
  async submitUserOperation(userOp: UserOperation): Promise<string> {
    console.log(`📤 [AAWalletService] Submitting UserOperation to bundler`);
    
    try {
      const contracts = getContractAddresses(this.chainId);
      
      // Submit to bundler via eth_sendUserOperation
      const response = await this.bundlerProvider.send('eth_sendUserOperation', [
        userOp,
        contracts.entryPoint,
      ]);
      
      const userOpHash = response;
      
      console.log(`✅ [AAWalletService] UserOp submitted: ${userOpHash}`);
      
      return userOpHash;
    } catch (error) {
      console.error('❌ [AAWalletService] Error submitting UserOp:', error);
      throw new Error(`Failed to submit UserOperation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get UserOperation receipt
   */
  async getUserOperationReceipt(userOpHash: string): Promise<UserOpReceipt | null> {
    console.log(`🔍 [AAWalletService] Getting receipt for ${userOpHash}`);
    
    try {
      const receipt = await this.bundlerProvider.send('eth_getUserOperationReceipt', [userOpHash]);
      
      if (!receipt) {
        return null;
      }
      
      console.log(`✅ [AAWalletService] Receipt found in block ${receipt.blockNumber}`);
      
      return {
        userOpHash,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        success: receipt.success,
        actualGasUsed: receipt.actualGasUsed,
        actualGasCost: receipt.actualGasCost,
      };
    } catch (error) {
      console.error('❌ [AAWalletService] Error getting receipt:', error);
      return null;
    }
  }
  
  /**
   * Wait for UserOperation to be included in a block
   */
  async waitForUserOperation(
    userOpHash: string,
    timeoutMs: number = 60000
  ): Promise<UserOpReceipt> {
    console.log(`⏳ [AAWalletService] Waiting for UserOp confirmation...`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const receipt = await this.getUserOperationReceipt(userOpHash);
      
      if (receipt) {
        console.log(`✅ [AAWalletService] UserOp confirmed!`);
        return receipt;
      }
      
      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('UserOperation confirmation timeout');
  }
  
  /**
   * Execute a transaction via AA wallet (high-level function)
   */
  async executeTransaction(params: {
    sender: string;
    target: string;
    value: bigint;
    data: string;
    signer: ethers.Signer;
    gasless?: boolean;
  }): Promise<{ userOpHash: string; txHash: string }> {
    console.log(`🚀 [AAWalletService] Executing transaction`);
    
    try {
      // 1. Create UserOperation
      const userOp = await this.createUserOperation(params);
      
      // 2. Get paymaster data if gasless
      if (params.gasless) {
        const paymasterData = await this.getPaymasterData(userOp);
        userOp.paymasterAndData = paymasterData.paymasterAndData;
        userOp.preVerificationGas = paymasterData.preVerificationGas;
        userOp.verificationGasLimit = paymasterData.verificationGasLimit;
        userOp.callGasLimit = paymasterData.callGasLimit;
      }
      
      // 3. Sign UserOperation
      const signature = await this.signUserOperation(userOp, params.signer);
      userOp.signature = signature;
      
      // 4. Submit to bundler
      const userOpHash = await this.submitUserOperation(userOp);
      
      // 5. Wait for confirmation
      const receipt = await this.waitForUserOperation(userOpHash);
      
      console.log(`✅ [AAWalletService] Transaction executed!`);
      console.log(`   UserOp Hash: ${userOpHash}`);
      console.log(`   Tx Hash: ${receipt.txHash}`);
      
      return {
        userOpHash,
        txHash: receipt.txHash,
      };
    } catch (error) {
      console.error('❌ [AAWalletService] Transaction failed:', error);
      throw error;
    }
  }
}

// Singleton instance
let aaWalletService: AAWalletService | null = null;

export function getAAWalletService(chainId?: number): AAWalletService {
  if (!aaWalletService || (chainId && aaWalletService['chainId'] !== chainId)) {
    aaWalletService = new AAWalletService(chainId);
  }
  return aaWalletService;
}

export default AAWalletService;
