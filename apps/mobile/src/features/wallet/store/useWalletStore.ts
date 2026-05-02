import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Hex } from "viem";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type WalletAccount = {
  id: string;
  address: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type TokenBalance = {
  symbol: string;
  name: string;
  address: string; // contract address or "native" for ETH
  balance: string;
  decimals: number;
  priceUsd?: number;
  valueUsd?: number;
  chain: string;
};

export type Transaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  chain: string;
};

// Account Abstraction wallet state
export type AAAccount = {
  id: string; // Database ID
  userId: string;
  walletId: string;
  walletIndex: number;
  deploymentMode: "portable" | "chain-specific";
  predictedAddress: string; // Counterfactual address
  ownerAddress: string; // EOA that controls this AA
  isDeployed: boolean;
  deploymentTxHash?: string;
  deploymentBlockNumber?: number;
  walletName: string;
  chainId: number;
  createdAt: string;
  deployedAt?: string;
};

export type DeploymentStatus = 'idle' | 'predicting' | 'deploying' | 'deployed' | 'failed';

export type PasskeyInfo = {
  id: string;
  credentialId: string;
  idRaw?: Hex; // Raw credential ID as Hex
  deviceName: string;
  deviceType: string;
  isOnChain?: boolean; // Whether this passkey is registered on-chain
  px?: Hex; // Public key X coordinate
  py?: Hex; // Public key Y coordinate
  lastUsedAt?: string;
  createdAt: string;
};

export type GuardianInfo = {
  id: string;
  address: string;
  name: string;
  email?: string;
  isActive: boolean;
  isConfirmed: boolean;
  addedAt: string;
  confirmedAt?: string;
};

type WalletStore = {
  // Wallet state (EOA)
  accounts: WalletAccount[];
  activeAccount: WalletAccount | null;
  activeAccountId: string | null;
  isWalletInitialized: boolean;
  
  // Computed properties
  primaryAccount: WalletAccount | null; // Alias for activeAccount
  
  // Account Abstraction state
  aaAccount: AAAccount | null;
  accountDeploymentStatus: DeploymentStatus;
  deploymentError?: string;
  passkeys: PasskeyInfo[];
  guardians: GuardianInfo[];
  
  // Balance state
  balances: TokenBalance[];
  totalBalanceUsd: number;
  balancesLoading: boolean;
  
  // Transaction state
  transactions: Transaction[];
  transactionsLoading: boolean;
  
  // Network state
  activeChainId: number;
  rpcUrl: string;
  
  // Actions
  setAccounts: (accounts: WalletAccount[]) => void;
  setActiveAccount: (account: WalletAccount) => void;
  setActiveAccountId: (accountId: string | null) => void;
  addAccount: (account: WalletAccount) => void;
  setWalletInitialized: (value: boolean) => void;
  
  // AA Actions
  setAAAccount: (account: AAAccount | null) => void;
  setDeploymentStatus: (status: DeploymentStatus, error?: string) => void;
  markAsDeployed: (txHash: string, blockNumber: number) => void;
  setPasskeys: (passkeys: PasskeyInfo[]) => void;
  addPasskey: (passkey: PasskeyInfo) => void;
  removePasskey: (passkeyId: string) => void;
  setGuardians: (guardians: GuardianInfo[]) => void;
  addGuardian: (guardian: GuardianInfo) => void;
  removeGuardian: (guardianId: string) => void;
  
  setBalances: (balances: TokenBalance[]) => void;
  setTotalBalanceUsd: (total: number) => void;
  setBalancesLoading: (loading: boolean) => void;
  
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  setTransactionsLoading: (loading: boolean) => void;
  
  setActiveChain: (chainId: number, rpcUrl: string) => void;
  
  reset: () => void;
};

const initialState = {
  accounts: [],
  activeAccount: null,
  activeAccountId: null,
  isWalletInitialized: false,
  aaAccount: null,
  accountDeploymentStatus: 'idle' as DeploymentStatus,
  deploymentError: undefined,
  passkeys: [],
  guardians: [],
  balances: [],
  totalBalanceUsd: 0,
  balancesLoading: false,
  transactions: [],
  transactionsLoading: false,
  activeChainId: 31337, // Anvil default
  rpcUrl: "http://10.0.2.2:8545", // Android emulator localhost
} satisfies Partial<WalletStore>;

export const useWalletStore = create<WalletStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Computed property
      get primaryAccount() {
        return get().activeAccount;
      },
      
      setAccounts: (accounts) => set({ accounts }),
      
      setActiveAccount: (account) => {
        set((state) => ({
          activeAccount: account,
          activeAccountId: account.id,
          accounts: state.accounts.map((acc) =>
            acc.id === account.id
              ? { ...acc, isActive: true }
              : { ...acc, isActive: false }
          ),
        }));
      },
      
      setActiveAccountId: (accountId) => set({ activeAccountId: accountId }),
      
      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account],
          activeAccount: state.activeAccount || account,
        })),
      
      setWalletInitialized: (value) => set({ isWalletInitialized: value }),
      
      // AA Actions
      setAAAccount: (account) => set({ aaAccount: account }),
      
      setDeploymentStatus: (status, error) =>
        set({ accountDeploymentStatus: status, deploymentError: error }),
      
      markAsDeployed: (txHash, blockNumber) =>
        set((state) => ({
          aaAccount: state.aaAccount
            ? {
                ...state.aaAccount,
                isDeployed: true,
                deploymentTxHash: txHash,
                deploymentBlockNumber: blockNumber,
                deployedAt: new Date().toISOString(),
              }
            : null,
          accountDeploymentStatus: 'deployed',
          deploymentError: undefined,
        })),
      
      setPasskeys: (passkeys) => set({ passkeys }),
      
      addPasskey: (passkey) =>
        set((state) => ({
          passkeys: [passkey, ...state.passkeys],
        })),
      
      removePasskey: (passkeyId) =>
        set((state) => ({
          passkeys: state.passkeys.filter((pk) => pk.id !== passkeyId),
        })),
      
      setGuardians: (guardians) => set({ guardians }),
      
      addGuardian: (guardian) =>
        set((state) => ({
          guardians: [guardian, ...state.guardians],
        })),
      
      removeGuardian: (guardianId) =>
        set((state) => ({
          guardians: state.guardians.filter((g) => g.id !== guardianId),
        })),
      
      setBalances: (balances) => set({ balances }),
      setTotalBalanceUsd: (total) => set({ totalBalanceUsd: total }),
      setBalancesLoading: (loading) => set({ balancesLoading: loading }),
      
      setTransactions: (transactions) => set({ transactions }),
      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [transaction, ...state.transactions],
        })),
      updateTransaction: (hash, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.hash === hash ? { ...tx, ...updates } : tx
          ),
        })),
      setTransactionsLoading: (loading) => set({ transactionsLoading: loading }),
      
      setActiveChain: (chainId, rpcUrl) => set({ activeChainId: chainId, rpcUrl }),
      
      reset: () => set({ ...initialState }),
    }),
    {
      name: "trezo-wallet-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({
        accounts,
        activeAccount,
        activeAccountId,
        isWalletInitialized,
        aaAccount,
        accountDeploymentStatus,
        passkeys,
        guardians,
        activeChainId,
        rpcUrl,
      }) => ({
        accounts,
        activeAccount,
        activeAccountId,
        isWalletInitialized,
        aaAccount,
        accountDeploymentStatus,
        passkeys,
        guardians,
        activeChainId,
        rpcUrl,
      }),
    }
  )
);
