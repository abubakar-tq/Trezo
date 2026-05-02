import { useCallback, useEffect, useState } from "react";
import { walletService } from "../services/WalletService";
import { useWalletStore, type TokenBalance, type Transaction, type WalletAccount } from "../store/useWalletStore";

export const useWallet = () => {
  const {
    accounts,
    activeAccount,
    isWalletInitialized,
    balances,
    totalBalanceUsd,
    balancesLoading,
    transactions,
    transactionsLoading,
    setAccounts,
    setActiveAccount,
    addAccount,
    setWalletInitialized,
    setBalances,
    setTotalBalanceUsd,
    setBalancesLoading,
    setTransactions,
    addTransaction,
    setTransactionsLoading,
  } = useWalletStore();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Initialize wallet - check if wallet exists
   */
  const initializeWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const hasWallet = await walletService.hasWallet();
      setWalletInitialized(hasWallet);
      
      console.log(`🔐 [useWallet] Wallet initialized: ${hasWallet}`);
      return hasWallet;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize wallet";
      setError(message);
      console.error("❌ [useWallet] Initialize error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setWalletInitialized]);

  /**
   * Create new wallet
   */
  const createWallet = useCallback(async (name: string = "Account 1") => {
    try {
      setLoading(true);
      setError(null);
      
      const { address, mnemonic } = await walletService.generateWallet();
      
      const newAccount: WalletAccount = {
        id: address,
        address,
        name,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      
      addAccount(newAccount);
      setWalletInitialized(true);
      
      console.log(`✅ [useWallet] Wallet created: ${address}`);
      return { address, mnemonic };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create wallet";
      setError(message);
      console.error("❌ [useWallet] Create wallet error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addAccount, setWalletInitialized]);

  /**
   * Import wallet from mnemonic
   */
  const importWalletFromMnemonic = useCallback(async (mnemonic: string, name: string = "Imported Account") => {
    try {
      setLoading(true);
      setError(null);
      
      const address = await walletService.importFromMnemonic(mnemonic);
      
      const newAccount: WalletAccount = {
        id: address,
        address,
        name,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      
      addAccount(newAccount);
      setWalletInitialized(true);
      
      console.log(`✅ [useWallet] Wallet imported: ${address}`);
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import wallet";
      setError(message);
      console.error("❌ [useWallet] Import wallet error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addAccount, setWalletInitialized]);

  /**
   * Import wallet from private key
   */
  const importWalletFromPrivateKey = useCallback(async (privateKey: string, name: string = "Imported Account") => {
    try {
      setLoading(true);
      setError(null);
      
      const address = await walletService.importFromPrivateKey(privateKey);
      
      const newAccount: WalletAccount = {
        id: address,
        address,
        name,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      
      addAccount(newAccount);
      setWalletInitialized(true);
      
      console.log(`✅ [useWallet] Wallet imported from private key: ${address}`);
      return address;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import wallet";
      setError(message);
      console.error("❌ [useWallet] Import wallet error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [addAccount, setWalletInitialized]);

  /**
   * Fetch balance for active account
   */
  const fetchBalance = useCallback(async () => {
    if (!activeAccount) {
      console.warn("⚠️ [useWallet] No active account");
      return;
    }

    try {
      setBalancesLoading(true);
      setError(null);
      
      const balance = await walletService.getBalance(activeAccount.address);
      
      const tokenBalance: TokenBalance = {
        symbol: "ETH",
        name: "Ethereum",
        address: "native",
        balance,
        decimals: 18,
        chain: "anvil",
      };
      
      setBalances([tokenBalance]);
      
      console.log(`✅ [useWallet] Balance fetched: ${balance} ETH`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch balance";
      setError(message);
      console.error("❌ [useWallet] Fetch balance error:", err);
    } finally {
      setBalancesLoading(false);
    }
  }, [activeAccount, setBalances, setBalancesLoading]);

  /**
   * Fetch transaction history
   */
  const fetchTransactions = useCallback(async () => {
    if (!activeAccount) {
      console.warn("⚠️ [useWallet] No active account");
      return;
    }

    try {
      setTransactionsLoading(true);
      setError(null);
      
      const txHistory = await walletService.getTransactionHistory(activeAccount.address);
      
      const transactions: Transaction[] = txHistory.map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        timestamp: tx.timestamp,
        status: "confirmed" as const,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        blockNumber: tx.blockNumber,
        chain: "anvil",
      }));
      
      setTransactions(transactions);
      
      console.log(`✅ [useWallet] Transactions fetched: ${transactions.length}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch transactions";
      setError(message);
      console.error("❌ [useWallet] Fetch transactions error:", err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [activeAccount, setTransactions, setTransactionsLoading]);

  /**
   * Send transaction
   */
  const sendTransaction = useCallback(async (to: string, amount: string) => {
    if (!activeAccount) {
      throw new Error("No active account");
    }

    try {
      setLoading(true);
      setError(null);
      
      const txHash = await walletService.sendTransaction({
        from: activeAccount.address,
        to,
        amount,
      });
      
      // Add pending transaction
      const pendingTx: Transaction = {
        hash: txHash,
        from: activeAccount.address,
        to,
        value: amount,
        timestamp: Math.floor(Date.now() / 1000),
        status: "pending",
        chain: "anvil",
      };
      
      addTransaction(pendingTx);
      
      console.log(`✅ [useWallet] Transaction sent: ${txHash}`);
      
      // Refresh balance after transaction
      setTimeout(() => {
        fetchBalance();
        fetchTransactions();
      }, 2000);
      
      return txHash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send transaction";
      setError(message);
      console.error("❌ [useWallet] Send transaction error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeAccount, addTransaction, fetchBalance, fetchTransactions]);

  /**
   * Get mnemonic for backup
   */
  const getMnemonic = useCallback(async () => {
    try {
      const mnemonic = await walletService.getMnemonic();
      return mnemonic;
    } catch (err) {
      console.error("❌ [useWallet] Get mnemonic error:", err);
      throw err;
    }
  }, []);

  /**
   * Switch active account
   */
  const switchAccount = useCallback((account: WalletAccount) => {
    setActiveAccount(account);
    // Refresh data for new account
    setTimeout(() => {
      fetchBalance();
      fetchTransactions();
    }, 100);
  }, [setActiveAccount, fetchBalance, fetchTransactions]);

  // Auto-fetch data when active account changes
  useEffect(() => {
    if (activeAccount && isWalletInitialized) {
      fetchBalance();
      fetchTransactions();
    }
  }, [activeAccount?.address, isWalletInitialized]);

  return {
    // State
    accounts,
    activeAccount,
    isWalletInitialized,
    balances,
    totalBalanceUsd,
    balancesLoading,
    transactions,
    transactionsLoading,
    loading,
    error,
    
    // Actions
    initializeWallet,
    createWallet,
    importWalletFromMnemonic,
    importWalletFromPrivateKey,
    fetchBalance,
    fetchTransactions,
    sendTransaction,
    getMnemonic,
    switchAccount,
  };
};
