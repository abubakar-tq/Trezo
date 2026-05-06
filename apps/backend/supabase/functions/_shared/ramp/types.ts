export type RampProviderType = 'transak' | 'mock';

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

export interface CreateSessionParams {
  userId: string;
  walletAddress: string;
  chainId: number;
  fiatCurrency: string;
  fiatAmount: number;
  cryptoCurrency: string;
}

export interface OnRampSession {
  orderId: string;
  provider: RampProviderType;
  widgetUrl?: string;
  status: RampStatus;
}

export interface IRampProvider {
  createSession(params: CreateSessionParams): Promise<OnRampSession>;
  handleWebhook(payload: any, signature?: string): Promise<{ orderId: string; status: RampStatus; rawPayload: any }>;
}
