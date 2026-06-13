import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getRampProvider } from "../_shared/ramp/factory.ts";
import { fulfillCompletedOrder } from "../_shared/ramp/fulfill.ts";

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
    // Read body as text first (kept verbatim for any future header-based checks).
    const bodyText = await req.text();
    const payload = JSON.parse(bodyText);
    const signature = req.headers.get("x-transak-signature") || undefined;
    // A genuine Transak webhook carries `data` as a signed JWT string. The
    // mobile client's optimistic nudge sends `data` as a plain object.
    const looksSigned = typeof payload?.data === "string";

    const provider = getRampProvider();
    const { orderId, status, rawPayload, verified, providerOrderId, data } =
      await provider.handleWebhook(payload, signature);

    if (!orderId) {
      console.error("[onramp-webhook] No orderId (partnerOrderId) in payload");
      return json({ error: "Order ID (partnerOrderId) not found in payload" }, { status: 400 });
    }

    // ── Authenticity gate ─────────────────────────────────────────────────────
    // Nothing financial happens for an unverified payload.
    //  • Looked signed but failed verification → 401 so Transak RETRIES (covers a
    //    transient access-token fetch failure; a forgery just keeps getting 401).
    //  • Unsigned object (the mobile client nudge) → 202 ignored: no retry, and
    //    crucially NO state change and NO fund movement. Completion authority is
    //    Transak's signed webhook + the app's polling, never the client.
    if (!verified) {
      if (looksSigned) {
        console.error(`[onramp-webhook] Rejecting UNVERIFIED signed webhook for order ${orderId}`);
        return json({ error: "Signature verification failed" }, { status: 401 });
      }
      console.log(`[onramp-webhook] Ignoring unverified client nudge for order ${orderId}`);
      return json({ ignored: true, reason: "unverified" }, { status: 202 });
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

    // 2. Build update payload. Financial fields come from the VERIFIED claims
    //    (data), never from the raw JWT string in the payload.
    const claims = data ?? {};
    const updateData: Record<string, unknown> = {
      internal_status: status,
      provider_status: payload.eventID || claims.status || order.provider_status,
      raw_payload: rawPayload,
      updated_at: new Date().toISOString(),
    };
    if (claims.transactionHash) updateData.tx_hash = claims.transactionHash;
    if (providerOrderId) updateData.provider_order_id = providerOrderId;
    if (claims.cryptoAmount) updateData.crypto_amount = claims.cryptoAmount;

    const { error: updateError } = await supabase
      .from("ramp_orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      console.error("[onramp-webhook] Update failed:", updateError);
      return json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[onramp-webhook] Order ${orderId} → ${status} (verified)`);

    // 3. Deliver funds on completion. Transak STAGING never delivers the real
    //    asset to the wallet, so WE do — but only for verified completions, and
    //    only off mainnet (on mainnet Transak itself delivers; we just recorded
    //    its tx hash above).
    if (status === "completed") {
      try {
        const fulfillmentTxHash = await fulfillCompletedOrder(order);

        if (fulfillmentTxHash) {
          await supabase
            .from("ramp_orders")
            .update({
              local_fulfillment_tx_hash: fulfillmentTxHash,
              internal_status: "local_mock_completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
          console.log(`[onramp-webhook] Fulfillment complete: ${fulfillmentTxHash}`);
        }
      } catch (fulfillErr) {
        // Never fail the webhook response — a 2xx prevents Transak retry storms.
        console.error("[onramp-webhook] Fulfillment failed (non-fatal):", fulfillErr);
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
