import { IRampProvider, CreateSessionParams, OnRampSession, WebhookResult, OrderStatusResult } from "../types.ts";
import { mapTransakStatus } from "../status.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { jwtVerify } from "npm:jose@5";

export class TransakProvider implements IRampProvider {
  private supabase;
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private apiGatewayUrl: string;
  /** Partner API host (refresh-token lives here, NOT on the api-gateway host). */
  private partnerApiUrl: string;
  private transakEnv: string;

  // Partner Access Token cache. Token is a JWT valid for 7 days; we re-fetch a
  // few minutes before expiry. Used as the HMAC secret to verify webhook JWTs.
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0; // unix seconds

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    this.supabase = createClient(supabaseUrl, supabaseKey);

    this.transakEnv = Deno.env.get("TRANSAK_ENV") || "STAGING";

    this.apiKey = Deno.env.get("TRANSAK_STAGING_API_KEY") ||
      Deno.env.get("TRANSAK_API_KEY") || "";
    this.apiSecret = Deno.env.get("TRANSAK_API_SECRET") ||
      Deno.env.get("TRANSAK_STAGING_API_SECRET") || "";

    if (this.transakEnv === "PRODUCTION") {
      this.baseUrl = "https://global.transak.com";
      this.apiGatewayUrl = "https://api-gateway.transak.com";
      this.partnerApiUrl = "https://api.transak.com";
    } else {
      // staging-global.transak.com is the correct staging widget domain.
      // global-stg.transak.com is the API gateway pattern, not the widget.
      this.baseUrl = "https://staging-global.transak.com";
      this.apiGatewayUrl = "https://api-gateway-stg.transak.com";
      this.partnerApiUrl = "https://api-stg.transak.com";
    }
  }

  /**
   * Fetch (and cache) the Partner Access Token used to both call authenticated
   * Transak endpoints and verify webhook JWTs.
   *
   * Transak docs — Create Partner Access Token:
   *   POST {partnerApiUrl}/partners/api/v2/refresh-token
   *   header: api-secret: <API_SECRET>
   *   body:   { "apiKey": "<API_KEY>" }
   *   resp:   { data: { accessToken: <JWT, 7d>, expiresAt: <unix sec> } }
   *
   * Returns null if credentials are missing or the call fails — callers must
   * treat a null token as "cannot verify" and refuse to trust the payload.
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.apiKey || !this.apiSecret) {
      console.warn(
        "[TransakProvider] TRANSAK_API_SECRET or api key missing — cannot fetch access token / verify webhooks"
      );
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (this.accessToken && nowSec < this.accessTokenExpiresAt - 300) {
      return this.accessToken;
    }

    try {
      const resp = await fetch(`${this.partnerApiUrl}/partners/api/v2/refresh-token`, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-secret": this.apiSecret,
        },
        body: JSON.stringify({ apiKey: this.apiKey }),
      });

      if (!resp.ok) {
        console.error(
          `[TransakProvider] refresh-token failed ${resp.status}: ${(await resp.text()).slice(0, 200)}`
        );
        return null;
      }

      const j = await resp.json();
      const token = j?.data?.accessToken || j?.accessToken || null;
      const expiresAt = Number(j?.data?.expiresAt || j?.expiresAt || nowSec + 7 * 24 * 3600);
      if (token) {
        this.accessToken = token;
        this.accessTokenExpiresAt = expiresAt;
        console.log("[TransakProvider] Fetched Partner Access Token (expires", expiresAt, ")");
      }
      return token;
    } catch (e) {
      console.error("[TransakProvider] refresh-token error:", e);
      return null;
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
      // REQUIRED by the Create Widget URL API. Must be whitelisted in the Transak
      // dashboard for PRODUCTION; staging accepts any value. Mobile has no real
      // referrer, so we send a configured stand-in domain.
      referrerDomain: Deno.env.get("TRANSAK_REFERRER_DOMAIN") || "trezo.app",
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

    // 3. Create Widget URL API (signed one-time URL — now the MANDATORY path;
    //    raw query params are being deprecated by Transak). Per docs:
    //      POST {apiGatewayUrl}/api/v2/auth/session
    //      header: access-token: <Partner Access Token>   (NOT the raw api key)
    //      body:   { widgetParams: { apiKey, ... } }
    //      resp:   { data: { widgetUrl } }   (valid 5 min, single-use)
    let widgetUrl: string | null = null;
    const accessToken = await this.getAccessToken();
    if (accessToken) {
      try {
        const sessionResp = await fetch(`${this.apiGatewayUrl}/api/v2/auth/session`, {
          method: "POST",
          headers: {
            "access-token": accessToken,
            "content-type": "application/json",
            "accept": "application/json",
          },
          body: JSON.stringify({ widgetParams }),
        });

        if (sessionResp.ok) {
          const sessionData = await sessionResp.json();
          widgetUrl = sessionData?.data?.widgetUrl || sessionData?.widgetUrl || null;
          if (widgetUrl) {
            console.log("[TransakProvider] Got signed widget URL from session API");
          } else {
            console.warn(
              "[TransakProvider] Session API ok but no widgetUrl:",
              JSON.stringify(sessionData).slice(0, 300)
            );
          }
        } else {
          const errText = await sessionResp.text();
          console.warn(`[TransakProvider] Create Widget URL API returned ${sessionResp.status}: ${errText.slice(0, 300)}`);
        }
      } catch (apiErr) {
        console.warn("[TransakProvider] Create Widget URL API failed:", apiErr);
      }
    } else {
      console.warn("[TransakProvider] No access token — cannot create signed widget URL, falling back to raw params");
    }

    // 4. Fallback: raw query params (DEPRECATED by Transak; last resort only).
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
    _signature?: string
  ): Promise<WebhookResult> {
    // Transak signs the webhook `data` field as a JWT using the Partner Access
    // Token. We VERIFY that signature (HS256, secret = the access-token string)
    // before trusting a single claim. `verified` gates every financial action
    // downstream: an unsigned/forged payload returns verified=false and the
    // webhook handler refuses to complete the order or move any funds.
    let orderData: any = {};
    let verified = false;

    if (typeof payload.data === "string") {
      const accessToken = await this.getAccessToken();
      if (accessToken) {
        try {
          const { payload: claims } = await jwtVerify(
            payload.data,
            new TextEncoder().encode(accessToken),
            { algorithms: ["HS256"] }
          );
          orderData = claims as Record<string, unknown>;
          verified = true;
          console.log("[TransakProvider] Webhook JWT signature verified ✅");
        } catch (err) {
          // Signature mismatch / expired token → decode-only so we can log which
          // order it referenced, but stay UNVERIFIED (caller must not act on it).
          console.error(
            "[TransakProvider] Webhook JWT verification FAILED — treating as unverified:",
            err instanceof Error ? err.message : err
          );
          orderData = this.decodeJwtPayload(payload.data) || {};
        }
      } else {
        console.warn("[TransakProvider] No access token available — webhook left UNVERIFIED");
        orderData = this.decodeJwtPayload(payload.data) || {};
      }
    } else if (payload.data && typeof payload.data === "object") {
      // Unsigned object payload (e.g. the mobile client's optimistic nudge).
      // Never trusted — used only as a UX hint, never to complete an order.
      orderData = payload.data;
    } else {
      orderData = payload;
    }

    const eventId = payload.eventID || (orderData as any).status || payload.status || "";
    const internalStatus = mapTransakStatus(eventId);
    // Our order id is Transak's `partnerOrderId`. Do NOT fall back to Transak's
    // own `id` here — that is a different key space and would corrupt lookups.
    const orderId = (orderData as any).partnerOrderId || payload.partnerOrderId;
    const providerOrderId =
      (orderData as any).id || (orderData as any).orderId || payload.orderId || undefined;

    console.log("[TransakProvider] Webhook received:", {
      eventId,
      orderId,
      providerOrderId,
      internalStatus,
      verified,
    });

    return {
      orderId,
      status: internalStatus,
      rawPayload: payload,
      verified,
      providerOrderId,
      data: orderData as Record<string, unknown>,
    };
  }

  /**
   * Pull the authoritative order status straight from Transak, keyed by OUR
   * partnerOrderId. No client-supplied id is trusted: we ask Transak "what is
   * the order whose partnerOrderId is X?" and read its real status. This is the
   * primary completion trigger — it does not depend on Transak calling us back.
   *
   *   GET {partnerApiUrl}/partners/api/v2/orders?partnerOrderId=<id>
   *     header: access-token: <Partner Access Token>
   *     resp:   { data: [ { id, status, walletAddress, cryptoAmount, transactionHash, ... } ] }
   */
  async fetchOrderStatus(partnerOrderId: string): Promise<OrderStatusResult> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      console.warn("[TransakProvider] fetchOrderStatus: no access token");
      return { found: false, status: "created" };
    }
    try {
      const url =
        `${this.partnerApiUrl}/partners/api/v2/orders?partnerOrderId=${encodeURIComponent(partnerOrderId)}`;
      const resp = await fetch(url, {
        headers: { "access-token": accessToken, "accept": "application/json" },
      });
      if (!resp.ok) {
        console.warn(`[TransakProvider] fetchOrderStatus ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
        return { found: false, status: "created" };
      }
      const j = await resp.json();
      const list: any[] = Array.isArray(j?.data)
        ? j.data
        : Array.isArray(j?.response)
        ? j.response
        : [];
      // Defensive: only accept an order that really carries our partnerOrderId.
      const order = list.find((o) => o?.partnerOrderId === partnerOrderId) || (list.length === 1 ? list[0] : null);
      if (!order) {
        return { found: false, status: "created" };
      }
      const statusStr = order.status || "";
      console.log("[TransakProvider] fetchOrderStatus:", {
        partnerOrderId,
        providerOrderId: order.id,
        status: statusStr,
      });
      return {
        found: true,
        status: mapTransakStatus(statusStr),
        providerOrderId: order.id,
        data: order,
      };
    } catch (e) {
      console.error("[TransakProvider] fetchOrderStatus error:", e);
      return { found: false, status: "created" };
    }
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
