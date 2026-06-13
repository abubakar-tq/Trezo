import { IRampProvider, CreateSessionParams, OnRampSession, WebhookResult, OrderStatusResult } from "../types.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export class MockProvider implements IRampProvider {
  private supabase;

  constructor() {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async createSession(params: CreateSessionParams): Promise<OnRampSession> {
    const { data, error } = await this.supabase
      .from("ramp_orders")
      .insert({
        user_id: params.userId,
        wallet_address: params.walletAddress,
        chain_id: params.chainId,
        provider: "mock",
        internal_status: "created",
        fiat_currency: params.fiatCurrency,
        fiat_amount: params.fiatAmount,
        crypto_currency: params.cryptoCurrency,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      orderId: data.id,
      provider: "mock",
      status: "created",
      // Mock provider might auto-redirect to a mock success page or just return success
      widgetUrl: `${Deno.env.get("PUBLIC_APP_URL")}/ramp/mock-success?orderId=${data.id}`,
    };
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    // The mock provider has no external webhook; this is only reachable from the
    // dev-only mock-complete path, which is already a trusted server context.
    return {
      orderId: payload.orderId,
      status: "completed",
      rawPayload: payload,
      verified: true,
      data: payload,
    };
  }

  // Mock has no external order system; the mock-complete path is used instead.
  fetchOrderStatus(_partnerOrderId: string): Promise<OrderStatusResult> {
    return Promise.resolve({ found: false, status: "created" });
  }
}
