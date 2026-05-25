// Live smoke-test for the ZK Email recovery API + upstream relayer.
//
// Boot the API:   npm --workspace apps/backend/zk-email-recovery-api run dev
// Run smoke:      npm --workspace apps/backend/zk-email-recovery-api run smoke
//
// What it checks (no on-chain mutation, no Supabase writes):
//   1. /health is up and reports the configured relayer
//   2. POST /zk-email/account-salt round-trips through the upstream relayer
//   3. /zk-email/acceptance-request validates payloads (expects 400 on garbage)
//   4. /zk-email/request-status returns a normalized status for a non-existent id
//
// Reads API_URL (default http://localhost:3001). Reads SMOKE_EMAIL (default
// smoke@example.com). Does not need Supabase service credentials — it only
// hits routes that don't touch the database.

import "dotenv/config";

const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const SMOKE_EMAIL = process.env.SMOKE_EMAIL ?? "smoke@example.com";
const SMOKE_ACCOUNT_CODE = process.env.SMOKE_ACCOUNT_CODE ?? "0x" + "11".repeat(32);

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
}

async function jsonPost(path: string, body: unknown) {
  const resp = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave as null */
  }
  return { status: resp.status, json, text };
}

async function jsonGet(path: string) {
  const resp = await fetch(`${API_URL}${path}`);
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* */
  }
  return { status: resp.status, json, text };
}

async function main() {
  console.log(`Smoke target: ${API_URL}`);

  // 1. health
  try {
    const h = await jsonGet("/health");
    record(
      "GET /health",
      h.status === 200 && h.json?.status === "ok",
      `status=${h.status} relayer=${h.json?.relayer} proofMode=${h.json?.proofMode}`,
    );
  } catch (err) {
    record("GET /health", false, `${err}`);
    process.exit(1);
  }

  // 2. account-salt round-trips through upstream relayer
  try {
    const r = await jsonPost("/zk-email/account-salt", {
      accountCode: SMOKE_ACCOUNT_CODE,
      guardianEmailAddr: SMOKE_EMAIL,
    });
    const hasSalt = !!r.json?.accountSalt;
    record(
      "POST /zk-email/account-salt",
      r.status === 200,
      `status=${r.status} accountSalt=${hasSalt ? "<set>" : "<null>"} (502 means relayer is down)`,
    );
  } catch (err) {
    record("POST /zk-email/account-salt", false, `${err}`);
  }

  // 3. payload validation
  try {
    const r = await jsonPost("/zk-email/acceptance-request", { garbage: true });
    record("POST /zk-email/acceptance-request (garbage -> 400)", r.status === 400, `status=${r.status}`);
  } catch (err) {
    record("POST /zk-email/acceptance-request (garbage -> 400)", false, `${err}`);
  }

  // 4. request-status for unknown id should still return 200 with status='pending' (or 502 if relayer rejects)
  try {
    const r = await jsonPost("/zk-email/request-status", { requestId: "smoke-unknown-id" });
    record(
      "POST /zk-email/request-status",
      r.status === 200 || r.status === 502,
      `status=${r.status} relayerStatus=${r.json?.status ?? "n/a"}`,
    );
  } catch (err) {
    record("POST /zk-email/request-status", false, `${err}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
