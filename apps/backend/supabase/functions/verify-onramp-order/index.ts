import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getRampProvider } from "../_shared/ramp/factory.ts";
import { fulfillCompletedOrder, needsTreasuryGrant } from "../_shared/ramp/fulfill.ts";

/**
 * verify-onramp-order
 *
 * The PRIMARY completion trigger. Authenticated (the caller must own the order).
 * It asks Transak directly — keyed by OUR partnerOrderId — for the order's real
 * status, so completion never depends on Transak calling our webhook back, and a
 * client can't fake it (we read the truth from Transak, not from the request).
 *
 * On a real `completed`, it records the result and runs fund delivery
 * (testnet treasury grant / Anvil), idempotently.
 *
 * Request:  { orderId: "<our ramp_orders uuid>" }
 * Response: { internalStatus, providerStatus, fulfillmentTxHash? }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });

const TERMINAL = ["completed", "local_mock_completed", "failed", "refunded", "expired"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  try {
    // 1. Authenticate the caller.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, { status: 401 });

    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, { status: 401 });

    const { orderId } = await req.json();
    if (!orderId) return json({ error: "orderId is required" }, { status: 400 });

    // 2. Load the order with the service role, then confirm it's the caller's.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: order, error: fetchErr } = await supabase
      .from("ramp_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !order) return json({ error: "Order not found" }, { status: 404 });
    if (order.user_id !== user.id) return json({ error: "Forbidden" }, { status: 403 });

    // 3. Idempotent: if already terminal, return current state untouched.
    if (TERMINAL.includes(order.internal_status)) {
      return json({
        internalStatus: order.internal_status,
        providerStatus: order.provider_status,
        fulfillmentTxHash: order.local_fulfillment_tx_hash ?? undefined,
        alreadyTerminal: true,
      });
    }

    // 4. Pull the authoritative status straight from the provider.
    const provider = getRampProvider(order.provider);
    const { found, status, providerOrderId, data } = await provider.fetchOrderStatus(orderId);

    if (!found) {
      // Transak doesn't know about it yet (user still mid-flow) — no-op.
      return json({ internalStatus: order.internal_status, providerStatus: order.provider_status, pending: true });
    }

    // 5. Decide the status to persist + deliver funds.
    //    For chains WE fund (testnet/Anvil), a Transak "completed" must NOT become
    //    terminal until our grant actually lands — otherwise a failed payout shows
    //    as success and never retries. So: try the grant first; on success →
    //    local_mock_completed; if still pending/failed → keep a non-terminal status
    //    so the next poll retries. Mainnet (no grant) → "completed" is correct.
    const claims = (data ?? {}) as Record<string, any>;
    let persistStatus = status;
    let fulfillmentTxHash: `0x${string}` | null = null;

    if (status === "completed" && needsTreasuryGrant(order.chain_id)) {
      try {
        fulfillmentTxHash = await fulfillCompletedOrder(order);
      } catch (fulfillErr) {
        console.error("[verify-onramp-order] Fulfillment threw:", fulfillErr);
      }
      persistStatus = fulfillmentTxHash ? "local_mock_completed" : "processing";
      if (!fulfillmentTxHash) {
        console.warn(
          `[verify-onramp-order] ${orderId}: Transak completed but treasury grant not delivered — staying retryable`
        );
      } else {
        console.log(`[verify-onramp-order] ${orderId}: granted, tx ${fulfillmentTxHash}`);
      }
    }

    const updateData: Record<string, unknown> = {
      internal_status: persistStatus,
      provider_status: claims.status || order.provider_status,
      updated_at: new Date().toISOString(),
    };
    if (providerOrderId) updateData.provider_order_id = providerOrderId;
    if (claims.transactionHash) updateData.tx_hash = claims.transactionHash;
    if (claims.cryptoAmount) updateData.crypto_amount = claims.cryptoAmount;
    if (fulfillmentTxHash) updateData.local_fulfillment_tx_hash = fulfillmentTxHash;
    await supabase.from("ramp_orders").update(updateData).eq("id", orderId);

    return json({
      internalStatus: persistStatus,
      providerStatus: claims.status || order.provider_status,
      fulfillmentTxHash: fulfillmentTxHash ?? undefined,
    });
  } catch (error) {
    console.error("[verify-onramp-order] Error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
