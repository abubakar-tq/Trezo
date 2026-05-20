import { IRampProvider, CreateSessionParams, OnRampSession, RampStatus } from "../types.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export class TransakProvider implements IRampProvider {
  private supabase;
  private apiKey: string;
  private baseUrl: string;
  private apiGatewayUrl: string;
  private transakEnv: string;

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    this.supabase = createClient(supabaseUrl, supabaseKey);

    this.transakEnv = Deno.env.get("TRANSAK_ENV") || "STAGING";

    this.apiKey = Deno.env.get("TRANSAK_STAGING_API_KEY") ||
      Deno.env.get("TRANSAK_API_KEY") || "";

    if (this.transakEnv === "PRODUCTION") {
      this.baseUrl = "https://global.transak.com";
      this.apiGatewayUrl = "https://api-gateway.transak.com";
    } else {
      // staging-global.transak.com is the correct staging widget domain.
      // global-stg.transak.com is the API gateway pattern, not the widget.
      this.baseUrl = "https://staging-global.transak.com";
      this.apiGatewayUrl = "https://api-gateway-stg.transak.com";
    }
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

    const network = this.mapChainIdToNetwork(params.chainId);

    // 2. Build widget params — only documented Transak widget query parameters.
    // `environment` is NOT a widget URL param; it is inferred from the domain
    // (global-stg.transak.com = staging, global.transak.com = production).
    // Passing it as a URL param causes Transak to return "Something went wrong".
    const widgetParams: Record<string, unknown> = {
      apiKey: this.apiKey,
      walletAddress: params.walletAddress,
      disableWalletAddressForm: true,
      fiatCurrency: params.fiatCurrency,
      fiatAmount: params.fiatAmount,
      // defaultCryptoCurrency lets Transak validate availability server-side
      // without hard-locking to a combo that might not be enabled for this key.
      defaultCryptoCurrency: params.cryptoCurrency,
      network,
      partnerOrderId: order.id,
      partnerCustomerId: params.userId,
      themeColor: "8B5CF6",
      colorMode: "dark",
    };

    // 3. Try Create Widget URL API (signed one-time URL, preferred approach).
    // Transak docs: POST body must include top-level `apiKey` in addition to
    // `widgetParams`. Response shape: { widgetUrl: "...", sessionId: "..." }.
    let widgetUrl: string | null = null;
    try {
      const sessionResp = await fetch(`${this.apiGatewayUrl}/api/v2/auth/session`, {
        method: "POST",
        headers: {
          "access-token": this.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ apiKey: this.apiKey, widgetParams }),
      });

      if (sessionResp.ok) {
        const sessionData = await sessionResp.json();
        // Transak returns { widgetUrl, sessionId } at the top level.
        // Older versions wrapped it in data: { url } or data: { accessId }.
        widgetUrl =
          sessionData?.widgetUrl ||
          sessionData?.data?.widgetUrl ||
          sessionData?.data?.url ||
          (sessionData?.data?.accessId
            ? `${this.baseUrl}?at=${sessionData.data.accessId}`
            : null) ||
          (sessionData?.accessId
            ? `${this.baseUrl}?at=${sessionData.accessId}`
            : null);
        if (widgetUrl) {
          console.log("[TransakProvider] Got signed widget URL from session API");
        } else {
          console.warn("[TransakProvider] Session API ok but no widgetUrl in response:", JSON.stringify(sessionData).slice(0, 300));
        }
      } else {
        const errText = await sessionResp.text();
        console.warn(`[TransakProvider] Create Widget URL API returned ${sessionResp.status}: ${errText}`);
      }
    } catch (apiErr) {
      console.warn("[TransakProvider] Create Widget URL API failed, using raw params fallback:", apiErr);
    }

    // 4. Fallback: raw query params (still works on the widget)
    if (!widgetUrl) {
      const qp = new URLSearchParams();
      for (const [k, v] of Object.entries(widgetParams)) {
        if (v !== undefined && v !== null) {
          qp.set(k, String(v));
        }
      }
      widgetUrl = `${this.baseUrl}?${qp.toString()}`;
      console.log("[TransakProvider] Using raw query param fallback URL:", widgetUrl);
    }

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
        console.warn("[TransakProvider] Could not decode JWT in payload.data — falling back");
        // data may be at payload root or payload.data as object
        orderData = payload.data || payload;
      }
    } else if (payload.data && typeof payload.data === "object") {
      orderData = payload.data;
    } else {
      orderData = payload;
    }

    const eventId = payload.eventID || orderData.status || payload.status || "";
    const internalStatus = this.mapTransakStatus(eventId);
    const orderId = orderData.partnerOrderId || payload.partnerOrderId || orderData.id;

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
      case "PROCESSING":
      case "PENDING_DELIVERY_FROM_TRANSAK":
        return "processing";
      case "ORDER_COMPLETED":
      case "COMPLETED":
        return "completed";
      case "ORDER_FAILED":
      case "REFUND_REQUEST_INITIATED":
      case "ORDER_CANCELLED":
      case "CANCELLED":
      case "FAILED":
        return "failed";
      case "ORDER_REFUNDED":
      case "REFUNDED":
        return "refunded";
      case "ORDER_EXPIRED":
      case "EXPIRED":
        return "expired";
      default:
        console.warn(`[TransakProvider] Unknown status: ${status}`);
        return "processing";
    }
  }

  private mapChainIdToNetwork(chainId: number): string {
    switch (chainId) {
      // Production mainnets
      case 1: return "ethereum";
      case 137: return "polygon";
      case 42161: return "arbitrum";
      case 10: return "optimism";
      case 8453: return "base";
      case 56: return "bsc";
      case 43114: return "avaxcchain";
      case 324: return "zksync";
      case 59144: return "linea";
      case 42220: return "celo";
      // Testnets
      case 11155111: return "ethereum";   // Sepolia → ethereum network
      case 84532: return "base";           // Base Sepolia → base network
      case 421614: return "arbitrum";      // Arbitrum Sepolia → arbitrum network
      case 80002: return "polygon";        // Polygon Amoy → polygon network
      case 97: return "bsc";              // BSC Testnet → bsc network
      case 11155420: return "optimism";   // Optimism Sepolia → optimism network
      case 59141: return "linea";         // Linea Sepolia → linea network
      // Local dev
      case 31337: return "ethereum";      // Anvil → ethereum (LocalFulfillmentService handles actual funding)
      default:
        console.warn(`[TransakProvider] Unknown chainId: ${chainId}, defaulting to ethereum`);
        return "ethereum";
    }
  }
}
