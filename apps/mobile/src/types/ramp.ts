export type RampProvider = 'transak' | 'mock';

export type TransakNetwork = 'ethereum' | 'base';

export interface TransakNetworkConfig {
  label: string;
  chainId: number;
  color: string;
  testnetName: string;
}

export const TRANSAK_NETWORKS: Record<TransakNetwork, TransakNetworkConfig> = {
  ethereum: {
    label: 'Sepolia',
    chainId: 11155111,
    color: '#627EEA',
    testnetName: 'Ethereum Sepolia',
  },
  base: {
    label: 'Base Sepolia',
    chainId: 84532,
    color: '#0052FF',
    testnetName: 'Base Sepolia',
  },
} as const;

export type RampStatus =
  | 'created'
  | 'widget_opened'
  | 'payment_pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'expired'
  | 'local_mock_completed';

export interface RampOrder {
  id: string;
  userId: string;
  walletAddress: string;
  chainId: number;
  provider: RampProvider;
  providerOrderId?: string;
  providerStatus: string;
  internalStatus: RampStatus;
  rampType: 'buy';
  fiatCurrency: string;
  fiatAmount: number;
  cryptoCurrency: string;
  cryptoAmount?: number;
  txHash?: string;
  localFulfillmentTxHash?: string;
  createdAt: string;
  updatedAt: string;
  rawPayload?: any;
}

export interface CreateOnRampSessionParams {
  walletAddress: string;
  chainId: number;
  fiatCurrency: string;
  cryptoCurrency: string;
  fiatAmount: number;
  provider?: RampProvider;
  transakNetwork?: TransakNetwork;
}

export interface OnRampSession {
  orderId: string;
  provider: RampProvider;
  widgetUrl?: string;
  status: RampStatus;
}
