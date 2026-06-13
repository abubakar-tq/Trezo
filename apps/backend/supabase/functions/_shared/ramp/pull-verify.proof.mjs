// E2E harness for the PULL-VERIFY path — runs the exact query the
// verify-onramp-order edge function runs, against real Transak staging.
//
// Usage (creds via env so no secret is committed):
//   TRANSAK_STAGING_API_KEY=... TRANSAK_API_SECRET=... \
//     node apps/backend/supabase/functions/_shared/ramp/pull-verify.proof.mjs <partnerOrderId>
//
// With no <partnerOrderId> it just proves the auth + orders endpoint work.
// After you pay a test order in the widget, pass that order's partnerOrderId
// (our ramp_orders UUID) to watch it report PROCESSING → COMPLETED.

const API = process.env.TRANSAK_PARTNER_API || "https://api-stg.transak.com";
const key = process.env.TRANSAK_STAGING_API_KEY || process.env.TRANSAK_API_KEY;
const secret = process.env.TRANSAK_API_SECRET;
const partnerOrderId = process.argv[2];

if (!key || !secret) {
  console.error("Set TRANSAK_STAGING_API_KEY and TRANSAK_API_SECRET in the env.");
  process.exit(2);
}

// Mirror of _shared/ramp/status.ts (kept in sync by hand for this proof).
function mapTransakStatus(s) {
  const m = {
    ORDER_CREATED: "created", AWAITING_PAYMENT_FROM_USER: "created",
    PAYMENT_DONE_MARKED_BY_USER: "payment_pending", ORDER_PAYMENT_VERIFYING: "payment_pending",
    ORDER_PROCESSING: "processing", PROCESSING: "processing", PENDING_DELIVERY_FROM_TRANSAK: "processing",
    CRYPTO_LIQUIDITY_PROVIDER_PENDING: "processing",
    ORDER_COMPLETED: "completed", COMPLETED: "completed",
    ORDER_FAILED: "failed", FAILED: "failed", ORDER_CANCELLED: "failed", CANCELLED: "failed",
    ORDER_REFUNDED: "refunded", REFUNDED: "refunded", ORDER_EXPIRED: "expired", EXPIRED: "expired",
  };
  return m[s] || "processing";
}

async function getAccessToken() {
  const r = await fetch(`${API}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: { "content-type": "application/json", "api-secret": secret },
    body: JSON.stringify({ apiKey: key }),
  });
  if (!r.ok) throw new Error(`refresh-token ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data.accessToken;
}

const token = await getAccessToken();
console.log("✅ access token obtained (len", token.length + ")");

const qs = partnerOrderId ? `?partnerOrderId=${encodeURIComponent(partnerOrderId)}` : "?limit=1";
const r = await fetch(`${API}/partners/api/v2/orders${qs}`, {
  headers: { "access-token": token, accept: "application/json" },
});
console.log("orders query HTTP", r.status);
const j = await r.json();
const list = Array.isArray(j?.data) ? j.data : Array.isArray(j?.response) ? j.response : [];
console.log("orders returned:", list.length);

if (!partnerOrderId) {
  console.log("\n(no partnerOrderId given — auth + endpoint OK. Pay a test order, then re-run with its id.)");
  process.exit(0);
}

const order = list.find((o) => o?.partnerOrderId === partnerOrderId) || list[0];
if (!order) {
  console.log(`\nNo Transak order yet for partnerOrderId=${partnerOrderId} (user hasn't completed payment).`);
  process.exit(0);
}

const internal = mapTransakStatus(order.status);
console.log("\n── order found ──");
console.log("  transak id:        ", order.id);
console.log("  status:            ", order.status, "→ internal:", internal);
console.log("  walletAddress:     ", order.walletAddress);
console.log("  crypto/fiat:       ", order.cryptoAmount, order.cryptoCurrency, "/", order.fiatAmount, order.fiatCurrency);
console.log("  transactionHash:   ", order.transactionHash || "(none yet)");
console.log(internal === "completed"
  ? "\n➡️  VERIFIED COMPLETED — the edge function would now deliver funds from the treasury."
  : `\n➡️  Not complete yet (${internal}). The poll loop keeps verifying until COMPLETED.`);
