import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getRampProvider } from "../_shared/ramp/factory.ts";
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

  // Transak usually sends POST webhooks
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const payload = await req.json();
    const signature = req.headers.get("x-transak-signature");

    const provider = getRampProvider();
    const { orderId, status, rawPayload } = await provider.handleWebhook(payload, signature || undefined);

    if (!orderId) {
      return json({ error: "Order ID not found in payload" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get existing order
    const { data: order, error: fetchError } = await supabase
      .from("ramp_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Update order status
    const updateData: any = {
      internal_status: status,
      provider_status: payload.status || order.provider_status,
      raw_payload: rawPayload,
      updated_at: new Date().toISOString(),
    };

    if (payload.transactionHash) {
      updateData.tx_hash = payload.transactionHash;
    }

    const { error: updateError } = await supabase
      .from("ramp_orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      return json({ error: updateError.message }, { status: 500 });
    }

    // 3. Trigger Local Fulfillment if completed and in hybrid mode
    if (status === "completed") {
      const fulfillmentService = new LocalFulfillmentService();
      const localTxHash = await fulfillmentService.fulfill({
        walletAddress: order.wallet_address,
        amount: order.fiat_amount / 2500, // Very rough crypto amount mock if not provided
        cryptoCurrency: order.crypto_currency,
        chainId: order.chain_id,
      });

      if (localTxHash) {
        await supabase
          .from("ramp_orders")
          .update({
            local_fulfillment_tx_hash: localTxHash,
            internal_status: "local_mock_completed"
          })
          .eq("id", orderId);
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error("OnRamp Webhook Error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
