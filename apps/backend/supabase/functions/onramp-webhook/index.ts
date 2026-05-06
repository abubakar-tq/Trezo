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

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Read body as text first so we can use it for signature verification
    const bodyText = await req.text();
    const payload = JSON.parse(bodyText);
    const signature = req.headers.get("x-transak-signature") || undefined;

    const provider = getRampProvider();
    const { orderId, status, rawPayload } = await provider.handleWebhook(payload, signature);

    if (!orderId) {
      console.error("[onramp-webhook] No orderId found in payload:", payload);
      return json({ error: "Order ID (partnerOrderId) not found in payload" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Fetch the existing order
    const { data: order, error: fetchError } = await supabase
      .from("ramp_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      console.error("[onramp-webhook] Order not found:", orderId, fetchError);
      return json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Build update payload
    const updateData: Record<string, unknown> = {
      internal_status: status,
      provider_status: payload.eventID || payload.status || order.provider_status,
      raw_payload: rawPayload,
      updated_at: new Date().toISOString(),
    };

    // Capture the on-chain tx hash if Transak sends it (ORDER_COMPLETED events)
    const orderData = payload.data || payload;
    if (orderData.transactionHash) {
      updateData.tx_hash = orderData.transactionHash;
    }
    if (orderData.providerOrderId || orderData.id) {
      updateData.provider_order_id = orderData.providerOrderId || orderData.id;
    }
    if (orderData.cryptoAmount) {
      updateData.crypto_amount = orderData.cryptoAmount;
    }

    const { error: updateError } = await supabase
      .from("ramp_orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("[onramp-webhook] Update failed:", updateError);
      return json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[onramp-webhook] Order ${orderId} updated to status: ${status}`);

    // 3. Trigger Local Fulfillment ONLY for hybrid mode:
    //    - status must be "completed" (Transak confirmed payment)
    //    - chainId must be 31337 (local Anvil)
    //    - LOCAL_DEV_FULFILLMENT=true
    //    This enables the FYP demo: real Transak staging payment → local Anvil funding
    if (status === "completed" && order.chain_id === 31337) {
      console.log("[onramp-webhook] Triggering local fulfillment for hybrid demo mode...");
      try {
        const fulfillmentService = new LocalFulfillmentService();
        const localTxHash = await fulfillmentService.fulfill({
          walletAddress: order.wallet_address,
          fiatAmount: Number(order.fiat_amount),
          cryptoCurrency: order.crypto_currency,
          chainId: order.chain_id,
        });

        if (localTxHash) {
          await supabase
            .from("ramp_orders")
            .update({
              local_fulfillment_tx_hash: localTxHash,
              internal_status: "local_mock_completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          console.log(`[onramp-webhook] Local fulfillment complete: ${localTxHash}`);
        }
      } catch (fulfillErr) {
        // Don't fail the webhook response — Transak expects 200 or it retries
        console.error("[onramp-webhook] Local fulfillment failed (non-fatal):", fulfillErr);
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error("[onramp-webhook] Unhandled error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});
