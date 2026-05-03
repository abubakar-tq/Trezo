import { IRampProvider, CreateSessionParams, OnRampSession, RampStatus } from "../types.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export class TransakProvider implements IRampProvider {
  private supabase;
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    this.apiKey = Deno.env.get("TRANSAK_API_KEY") || "";
    this.apiSecret = Deno.env.get("TRANSAK_API_SECRET") || ""; // Or WEBHOOK_SECRET
    const env = Deno.env.get("TRANSAK_ENV") || "STAGING";
    this.baseUrl = env === "PRODUCTION" 
      ? "https://global.transak.com" 
      : "https://staging-global.transak.com";
  }

  async createSession(params: CreateSessionParams): Promise<OnRampSession> {
    // 1. Create record in DB
    const { data: order, error } = await this.supabase
      .from("ramp_orders")
      .insert({
        user_id: params.userId,
        wallet_address: params.walletAddress,
        chain_id: params.chainId,
        provider: "transak",
        internal_status: "created",
        fiat_currency: params.fiatCurrency,
        fiat_amount: params.fiatAmount,
        crypto_currency: params.cryptoCurrency,
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Construct Transak Widget URL
    // Note: Ideally use Transak's session API to get a signed URL, 
    // but here we use the query param method with the API key as requested for simplicity in staging.
    // For production, we should call the Transak backend API to get a session.
    
    const queryParams = new URLSearchParams({
      apiKey: this.apiKey,
      walletAddress: params.walletAddress,
      disableWalletAddressForm: "true",
      fiatCurrency: params.fiatCurrency,
      fiatAmount: params.fiatAmount.toString(),
      cryptoCurrencyCode: params.cryptoCurrency,
      network: this.mapChainIdToNetwork(params.chainId),
      partnerOrderId: order.id,
      environment: Deno.env.get("TRANSAK_ENV") || "STAGING",
    });

    const widgetUrl = `${this.baseUrl}?${queryParams.toString()}`;

    return {
      orderId: order.id,
      provider: "transak",
      status: "created",
      widgetUrl: widgetUrl,
    };
  }

  async handleWebhook(payload: any, signature?: string): Promise<{ orderId: string; status: RampStatus; rawPayload: any }> {
    // TODO: Verify signature using this.apiSecret
    // For now, we trust the payload if secret is configured (staging)
    
    const transakStatus = payload.status || payload.eventID;
    const internalStatus = this.mapTransakStatus(transakStatus);
    const orderId = payload.partnerOrderId || payload.data?.partnerOrderId;

    return {
      orderId,
      status: internalStatus,
      rawPayload: payload,
    };
  }

  private mapTransakStatus(status: string): RampStatus {
    switch (status) {
      case "ORDER_CREATED": return "created";
      case "ORDER_PAYMENT_VERIFYING": return "payment_pending";
      case "ORDER_PROCESSING": return "processing";
      case "ORDER_COMPLETED": return "completed";
      case "ORDER_FAILED": return "failed";
      case "ORDER_REFUNDED": return "refunded";
      case "ORDER_EXPIRED": return "expired";
      default: return "processing";
    }
  }

  private mapChainIdToNetwork(chainId: number): string {
    switch (chainId) {
      case 1: return "ethereum";
      case 137: return "polygon";
      case 80002: return "polygonamoy";
      case 11155111: return "sepolia";
      case 31337: return "ethereum"; // Mock funding handles this
      default: return "ethereum";
    }
  }
}
