import { formatEther, JsonRpcProvider, parseEther, Wallet } from "ethers";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const WALLET_KEY_PREFIX = "trezo_wallet_";
const MNEMONIC_KEY = "trezo_wallet_mnemonic";

// RPC URLs for Android/iOS
const getRpcUrl = (chainId: number = 31337): string => {
  if (chainId === 31337) {
    // Local Anvil
    return Platform.OS === "android" 
      ? "http://10.0.2.2:8545" 
      : "http://192.168.100.68:8545";
  }
  // Add other chains later
  return "http://10.0.2.2:8545";
};

export class WalletService {
  private provider: JsonRpcProvider;
  private chainId: number;

  constructor(chainId: number = 31337) {
    this.chainId = chainId;
    const rpcUrl = getRpcUrl(chainId);
    this.provider = new JsonRpcProvider(rpcUrl);
    console.log(`🔗 [WalletService] Connected to RPC: ${rpcUrl}`);
  }

  /**
   * Generate a new wallet with mnemonic
   */
  async generateWallet(): Promise<{ address: string; mnemonic: string }> {
    try {
      console.log("🔐 [WalletService] Generating new wallet...");
      
      // Generate random mnemonic
      const wallet = Wallet.createRandom();
      const mnemonic = wallet.mnemonic?.phrase;
      
      if (!mnemonic) {
        throw new Error("Failed to generate mnemonic");
      }

      const address = wallet.address;
      const privateKey = wallet.privateKey;

      // Store securely
      await SecureStore.setItemAsync(MNEMONIC_KEY, mnemonic, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      
      await SecureStore.setItemAsync(`${WALLET_KEY_PREFIX}${address}`, privateKey, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      console.log(`✅ [WalletService] Wallet generated: ${address}`);
      return { address, mnemonic };
    } catch (error) {
      console.error("❌ [WalletService] Error generating wallet:", error);
      throw new Error("Failed to generate wallet");
    }
  }

  /**
   * Import wallet from mnemonic
   */
  async importFromMnemonic(mnemonic: string): Promise<string> {
    try {
      console.log("📥 [WalletService] Importing wallet from mnemonic...");
      
      const wallet = Wallet.fromPhrase(mnemonic);
      const address = wallet.address;
      const privateKey = wallet.privateKey;

      // Store securely
      await SecureStore.setItemAsync(MNEMONIC_KEY, mnemonic, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      
      await SecureStore.setItemAsync(`${WALLET_KEY_PREFIX}${address}`, privateKey, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      console.log(`✅ [WalletService] Wallet imported: ${address}`);
      return address;
    } catch (error) {
      console.error("❌ [WalletService] Error importing wallet:", error);
      throw new Error("Invalid mnemonic phrase");
    }
  }

  /**
   * Import wallet from private key
   */
  async importFromPrivateKey(privateKey: string): Promise<string> {
    try {
      console.log("📥 [WalletService] Importing wallet from private key...");
      
      const wallet = new Wallet(privateKey);
      const address = wallet.address;

      // Store securely
      await SecureStore.setItemAsync(`${WALLET_KEY_PREFIX}${address}`, privateKey, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      console.log(`✅ [WalletService] Wallet imported: ${address}`);
      return address;
    } catch (error) {
      console.error("❌ [WalletService] Error importing wallet:", error);
      throw new Error("Invalid private key");
    }
  }

  /**
   * Get wallet instance from address
   */
  private async getWallet(address: string): Promise<Wallet> {
    const privateKey = await SecureStore.getItemAsync(`${WALLET_KEY_PREFIX}${address}`);
    
    if (!privateKey) {
      throw new Error("Wallet not found");
    }

    return new Wallet(privateKey, this.provider);
  }

  /**
   * Get ETH balance
   */
  async getBalance(address: string): Promise<string> {
    try {
      console.log(`💰 [WalletService] Fetching balance for ${address}...`);
      
      const balance = await this.provider.getBalance(address);
      const balanceInEth = formatEther(balance);
      
      console.log(`✅ [WalletService] Balance: ${balanceInEth} ETH`);
      return balanceInEth;
    } catch (error) {
      console.error("❌ [WalletService] Error fetching balance:", error);
      throw new Error("Failed to fetch balance");
    }
  }

  /**
   * Send ETH transaction
   */
  async sendTransaction(params: {
    from: string;
    to: string;
    amount: string; // in ETH
  }): Promise<string> {
    try {
      console.log(`💸 [WalletService] Sending ${params.amount} ETH from ${params.from} to ${params.to}...`);
      
      const wallet = await this.getWallet(params.from);
      const tx = await wallet.sendTransaction({
        to: params.to,
        value: parseEther(params.amount),
      });

      console.log(`⏳ [WalletService] Transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`✅ [WalletService] Transaction confirmed in block ${receipt?.blockNumber}`);
      
      return tx.hash;
    } catch (error) {
      console.error("❌ [WalletService] Error sending transaction:", error);
      throw new Error("Failed to send transaction");
    }
  }

  /**
   * Get transaction history (simplified - from provider)
   */
  async getTransactionHistory(address: string, limit: number = 10): Promise<any[]> {
    try {
      console.log(`📜 [WalletService] Fetching transaction history for ${address}...`);
      
      // Note: For production, use Moralis or Etherscan API
      // For local testing, we'll get recent blocks and filter
      const currentBlock = await this.provider.getBlockNumber();
      const transactions: any[] = [];

      // Scan last 100 blocks (adjust as needed)
      const startBlock = Math.max(0, currentBlock - 100);
      
      for (let i = currentBlock; i > startBlock && transactions.length < limit; i--) {
        try {
          const block = await this.provider.getBlock(i, true);
          if (block && block.transactions) {
            for (const tx of block.transactions) {
              if (typeof tx !== 'string') {
                if (tx.from.toLowerCase() === address.toLowerCase() || 
                    tx.to?.toLowerCase() === address.toLowerCase()) {
                  transactions.push({
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to || '',
                    value: formatEther(tx.value),
                    blockNumber: tx.blockNumber,
                    timestamp: block.timestamp,
                    gasPrice: tx.gasPrice ? formatEther(tx.gasPrice) : '0',
                  });
                  
                  if (transactions.length >= limit) break;
                }
              }
            }
          }
        } catch (blockError) {
          console.warn(`⚠️ [WalletService] Error fetching block ${i}:`, blockError);
        }
      }

      console.log(`✅ [WalletService] Found ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      console.error("❌ [WalletService] Error fetching transaction history:", error);
      return [];
    }
  }

  /**
   * Check if wallet exists
   */
  async hasWallet(): Promise<boolean> {
    const mnemonic = await SecureStore.getItemAsync(MNEMONIC_KEY);
    return Boolean(mnemonic);
  }

  /**
   * Get stored mnemonic (for backup display)
   */
  async getMnemonic(): Promise<string | null> {
    return await SecureStore.getItemAsync(MNEMONIC_KEY);
  }

  /**
   * Get network info
   */
  async getNetworkInfo(): Promise<{ chainId: number; blockNumber: number }> {
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    
    return {
      chainId: Number(network.chainId),
      blockNumber,
    };
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(params: { from: string; to: string; amount: string }): Promise<string> {
    try {
      const gasEstimate = await this.provider.estimateGas({
        from: params.from,
        to: params.to,
        value: parseEther(params.amount),
      });
      
      return formatEther(gasEstimate);
    } catch (error) {
      console.error("❌ [WalletService] Error estimating gas:", error);
      throw new Error("Failed to estimate gas");
    }
  }

  /**
   * Clear all wallet data (logout/reset)
   */
  async clearWalletData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(MNEMONIC_KEY);
      // Note: We can't easily enumerate all wallet keys, so we clear known ones
      console.log("✅ [WalletService] Wallet data cleared");
    } catch (error) {
      console.error("❌ [WalletService] Error clearing wallet data:", error);
    }
  }
}

// Singleton instance
export const walletService = new WalletService();
