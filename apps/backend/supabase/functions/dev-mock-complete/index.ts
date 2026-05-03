import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { LocalFulfillmentService } from "../_shared/ramp/LocalFulfillmentService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // SECURITY GUARD: Never enable in production
  if (Deno.env.get("TRANSAK_ENV") === "PRODUCTION") {
    return json({ error: "Dev endpoint disabled in production" }, { status: 403 });
  }

  try {
    const { orderId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: order, error: fetchError } = await supabase
      .from("ramp_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return json({ error: "Order not found" }, { status: 404 });
    }

    if (order.provider !== "mock") {
      return json({ error: "Can only mock complete mock orders" }, { status: 400 });
    }

    // Trigger local fulfillment
    const fulfillmentService = new LocalFulfillmentService();
    const localTxHash = await fulfillmentService.fulfill({
      walletAddress: order.wallet_address,
      amount: order.fiat_amount / 2500,
      cryptoCurrency: order.crypto_currency,
      chainId: order.chain_id,
    });

    await supabase
      .from("ramp_orders")
      .update({
        internal_status: "local_mock_completed",
        provider_status: "COMPLETED",
        local_fulfillment_tx_hash: localTxHash || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return json({ success: true, localTxHash });
  } catch (error) {
    console.error("Mock Complete Error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
