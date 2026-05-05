export type RampProvider = 'transak' | 'mock';

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
}

export interface OnRampSession {
  orderId: string;
  provider: RampProvider;
  widgetUrl?: string; // Transak session URL
  status: RampStatus;
}
