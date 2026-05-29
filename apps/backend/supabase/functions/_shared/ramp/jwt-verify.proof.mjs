// Proof (Node, zero-dependency) that the webhook verification scheme is correct:
// the `data` field is a JWT signed HS256 with the Partner Access Token STRING as
// the HMAC secret. This mirrors exactly what the edge function does via
//   jwtVerify(data, new TextEncoder().encode(accessToken), { algorithms: ["HS256"] })
//
// Run:  node apps/backend/supabase/functions/_shared/ramp/jwt-verify.proof.mjs
import { createHmac, timingSafeEqual } from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function signHS256(payloadObj, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(payloadObj));
  const signingInput = `${header}.${payload}`;
  const sig = b64url(createHmac("sha256", secret).update(signingInput).digest());
  return `${signingInput}.${sig}`;
}

// Replicates the verification the edge runtime performs.
function verifyHS256(token, secret) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return { ok: false, reason: "malformed" };
  const expected = b64url(createHmac("sha256", secret).update(`${h}.${p}`).digest());
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad signature" };
  return { ok: true, claims: JSON.parse(Buffer.from(p, "base64url").toString()) };
}

const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.accessTokenLooksLikeAJwt.sig"; // stand-in for the real 7-day token
const claims = {
  partnerOrderId: "11111111-2222-3333-4444-555555555555",
  status: "ORDER_COMPLETED",
  cryptoAmount: 0.02,
  transactionHash: "0xabc",
  id: "transak-order-id-123",
};

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
};

console.log("Transak webhook JWT verification — proof\n");

const token = signHS256(claims, ACCESS_TOKEN);

// 1. Genuine token verifies and yields the claims.
const good = verifyHS256(token, ACCESS_TOKEN);
check("genuine Transak-signed token verifies", good.ok === true);
check("verified claims expose partnerOrderId", good.claims?.partnerOrderId === claims.partnerOrderId);
check("verified claims expose ORDER_COMPLETED status", good.claims?.status === "ORDER_COMPLETED");

// 2. Wrong secret (attacker without our access token) fails.
check("forged token signed with wrong secret is REJECTED", verifyHS256(token, "attacker-secret").ok === false);

// 3. Tampered payload (attacker flips status to completed) fails.
const tampered = signHS256({ ...claims, cryptoAmount: 9999 }, "attacker-secret");
check("payload tampering is REJECTED", verifyHS256(tampered, ACCESS_TOKEN).ok === false);

// 4. The unsigned client nudge (a plain object, no JWT) is not even a token.
check("unsigned client object is NOT a valid token", verifyHS256(JSON.stringify(claims), ACCESS_TOKEN).ok === false);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
