import { IRampProvider, CreateSessionParams, OnRampSession, RampStatus } from "../types.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export class TransakProvider implements IRampProvider {
  private supabase;
  private apiKey: string;
  private baseUrl: string;
  private transakEnv: string;

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    this.supabase = createClient(supabaseUrl, supabaseKey);

    this.transakEnv = Deno.env.get("TRANSAK_ENV") || "STAGING";

    // Support both TRANSAK_STAGING_API_KEY and TRANSAK_API_KEY
    this.apiKey = Deno.env.get("TRANSAK_STAGING_API_KEY") ||
      Deno.env.get("TRANSAK_API_KEY") || "";

    this.baseUrl = this.transakEnv === "PRODUCTION"
      ? "https://global.transak.com"
      : "https://staging-global.transak.com";
  }

  async createSession(params: CreateSessionParams): Promise<OnRampSession> {
    // 1. Persist order in DB first so we have an ID for partnerOrderId
    const { data: order, error } = await this.supabase
      .from("ramp_orders")
      .insert({
        user_id: params.userId,
        wallet_address: params.walletAddress,
        chain_id: params.chainId,
        provider: "transak",
        internal_status: "created",
        provider_status: "ORDER_CREATED",
        fiat_currency: params.fiatCurrency,
        fiat_amount: params.fiatAmount,
        crypto_currency: params.cryptoCurrency,
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Build Transak widget URL
    // The domain determines staging vs production — no extra `environment` param needed.
    const queryParams = new URLSearchParams({
      apiKey: this.apiKey,
      walletAddress: params.walletAddress,
      disableWalletAddressForm: "true",
      fiatCurrency: params.fiatCurrency,
      fiatAmount: params.fiatAmount.toString(),
      cryptoCurrencyCode: params.cryptoCurrency,
      network: this.mapChainIdToNetwork(params.chainId),
      // partnerOrderId lets our webhook match Transak events to our DB row
      partnerOrderId: order.id,
      // partnerCustomerId enables KYC re-use for the same user across orders
      partnerCustomerId: params.userId,
    });

    const widgetUrl = `${this.baseUrl}?${queryParams.toString()}`;

    return {
      orderId: order.id,
      provider: "transak",
      status: "created",
      widgetUrl,
    };
  }

  async handleWebhook(
    payload: any,
    signature?: string
  ): Promise<{ orderId: string; status: RampStatus; rawPayload: any }> {
    // Transak sends payload.data as a signed JWT (not a plain object).
    // Decode it without verifying signature — we just need the claims.
    // For production, full JWT verification using the Partner Access Token
    // (obtained from api-stg.transak.com/partners/api/v2/refresh-token) should be added.
    let orderData: any = {};

    if (typeof payload.data === "string") {
      const decoded = this.decodeJwtPayload(payload.data);
      if (decoded) {
        orderData = decoded;
      } else {
        console.warn("[TransakProvider] Could not decode JWT in payload.data — falling back to root payload");
        orderData = payload;
      }
    } else if (payload.data && typeof payload.data === "object") {
      // Older / plain-object format — handle gracefully
      orderData = payload.data;
    } else {
      orderData = payload;
    }

    const eventId = payload.eventID || orderData.status || payload.status || "";
    const internalStatus = this.mapTransakStatus(eventId);
    // partnerOrderId is the UUID we passed when building the widget URL
    const orderId = orderData.partnerOrderId || payload.partnerOrderId;

    console.log("[TransakProvider] Webhook received:", { eventId, orderId, internalStatus });

    return {
      orderId,
      status: internalStatus,
      rawPayload: payload,
    };
  }

  /**
   * Decode a JWT payload without verifying the signature.
   * Transak signs the webhook data field as a JWT — we extract the claims
   * to read partnerOrderId, cryptoAmount, transactionHash etc.
   */
  private decodeJwtPayload(jwt: string): any | null {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) return null;
      // base64url → base64
      const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  private mapTransakStatus(status: string): RampStatus {
    switch (status) {
      case "ORDER_CREATED":
      case "AWAITING_PAYMENT_FROM_USER":
        return "created";
      case "PAYMENT_DONE_MARKED_BY_USER":
      case "ORDER_PAYMENT_VERIFYING":
        return "payment_pending";
      case "ORDER_PROCESSING":
      case "CRYPTO_LIQUIDITY_PROVIDER_PENDING":
        return "processing";
      case "ORDER_COMPLETED":
        return "completed";
      case "ORDER_FAILED":
      case "REFUND_REQUEST_INITIATED":
      case "ORDER_CANCELLED":
        return "failed";
      case "ORDER_REFUNDED":
        return "refunded";
      case "ORDER_EXPIRED":
        return "expired";
      default:
        console.warn(`[TransakProvider] Unknown status: ${status}, defaulting to processing`);
        return "processing";
    }
  }

  private mapChainIdToNetwork(chainId: number): string {
    switch (chainId) {
      case 1: return "ethereum";
      case 137: return "polygon";
      case 80002: return "polygon"; // Amoy testnet uses polygon network code in Transak
      case 11155111: return "ethereum"; // Sepolia - Transak staging uses ethereum
      case 42161: return "arbitrum";
      case 10: return "optimism";
      case 8453: return "base";
      case 31337: return "ethereum"; // Local Anvil - LocalFulfillmentService handles actual funding
      default: return "ethereum";
    }
  }
}
