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

export interface WebhookResult {
  orderId: string;
  status: RampStatus;
  rawPayload: any;
  /**
   * True only when the payload's authenticity was cryptographically proven —
   * for Transak, the `data` JWT verified against the Partner Access Token.
   * The webhook handler MUST refuse to complete an order or trigger any
   * fund movement when this is false (e.g. an unsigned client-side nudge).
   */
  verified: boolean;
  /** Transak's own order id, when present, for server-side reconciliation. */
  providerOrderId?: string;
  /**
   * The decoded (and, for Transak, signature-verified) order claims —
   * transactionHash, cryptoAmount, status, etc. Read financial fields from
   * here, never from the raw JWT string in rawPayload.data.
   */
  // deno-lint-ignore no-explicit-any
  data?: Record<string, any>;
}

export interface OrderStatusResult {
  /** Whether Transak knows about an order for this partnerOrderId yet. */
  found: boolean;
  status: RampStatus;
  providerOrderId?: string;
  // deno-lint-ignore no-explicit-any
  data?: Record<string, any>;
}

export interface IRampProvider {
  createSession(params: CreateSessionParams): Promise<OnRampSession>;
  handleWebhook(payload: any, signature?: string): Promise<WebhookResult>;
  /**
   * Pull the authoritative order status directly from the provider, keyed by
   * OUR partnerOrderId (zero client trust). Used by the verify-onramp-order
   * function so completion never depends on the provider calling us back.
   */
  fetchOrderStatus(partnerOrderId: string): Promise<OrderStatusResult>;
}
