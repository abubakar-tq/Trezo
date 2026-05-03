import { IRampProvider, CreateSessionParams, OnRampSession, RampStatus } from "../types.ts";
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

  async handleWebhook(payload: any): Promise<{ orderId: string; status: RampStatus; rawPayload: any }> {
    // For mock, we might not have a real webhook, but we use this for the dev-mock-complete endpoint
    return {
      orderId: payload.orderId,
      status: "completed",
      rawPayload: payload,
    };
  }
}
