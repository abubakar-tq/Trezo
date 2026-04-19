export type { TokenBalance, Transaction, WalletAccount } from "../store/useWalletStore";

export type WalletCreationResult = {
  address: string;
  mnemonic: string;
};

export type TransactionParams = {
  to: string;
  amount: string;
  gasLimit?: string;
};

export type NetworkConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  symbol: string;
  explorerUrl?: string;
};
