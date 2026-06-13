# Transak on-ramp: verified webhook is the only authority for completion, and a Trezo treasury EOA delivers funds on testnet

**Status:** accepted
**Date:** 2026-05-30

## Context

The on-ramp (ADR-less until now; built from `docs/plans/2026-05-02-on-ramp-integration.md`) had two unfinished pieces that the plan explicitly called for ("verify signature from Transak") but the implementation skipped:

1. **No signature verification.** `TransakProvider.handleWebhook` *decoded* the webhook `data` JWT without *verifying* it, and `onramp-webhook` runs with `verify_jwt = false` (correct — Transak can't present a Supabase JWT). The happy path didn't even involve Transak's servers: the mobile client called `onramp-webhook` itself (`RampService.notifyWebhook`) after seeing `TRANSAK_ORDER_SUCCESSFUL`. Completion was therefore **client-asserted and spoofable** — anyone with an order UUID could `POST {data:{partnerOrderId, status:"ORDER_COMPLETED"}}` and complete it (and trigger Anvil funding).

2. **Funds never actually arrive on testnet.** Per Transak's docs, STAGING delivers nothing for native tokens (ETH) and a `TRNSK` test token (not the real asset) for ERC-20s. So "buy crypto, see it land in my testnet wallet" is impossible via Transak staging alone.

## Decision

**Verification is the gate, and it is the *only* authority for completion.**

- `TransakProvider` fetches a **Partner Access Token** (`POST {api-host}/partners/api/v2/refresh-token`, header `api-secret`, body `{apiKey}` → `{ data: { accessToken, expiresAt } }`, cached, 7-day JWT) and **verifies** the webhook `data` JWT with it (`jwtVerify(data, accessToken, {algorithms:["HS256"]})`). `handleWebhook` returns `verified: boolean` + the decoded `data`.
- `onramp-webhook` performs no financial action unless `verified`:
  - **signed but verification failed →** `401` (Transak retries; covers a transient token-fetch failure, and a forgery just keeps getting 401);
  - **unsigned object (the client nudge) →** `202 ignored`, no state change, no funds.
- `RampService.notifyWebhook` is **demoted to a non-authoritative UX hint**.

**Pull-verify is the PRIMARY completion trigger; the signed webhook is secondary.**

- A new authenticated function `verify-onramp-order` asks Transak directly — keyed by **our** `partnerOrderId` (`GET /partners/api/v2/orders?partnerOrderId=…` with the access token) — for the order's real status, and on `completed` runs fund delivery. The mobile app calls it on `TRANSAK_ORDER_SUCCESSFUL` and on every poll tick until terminal.
- Why primary: it needs **no webhook registration**, doesn't depend on Transak calling us back, works identically on staging and mainnet, and is unforgeable (we read the truth from Transak, not from the client; we also reject any returned order whose `partnerOrderId` isn't ours).
- The signed webhook (`onramp-webhook`, JWT-verified) remains wired as a redundant push path; both triggers converge on the same idempotent fulfillment.

**On testnet, Trezo delivers the funds; on mainnet, Transak does.**

- A `TestnetFulfillmentService` sends real testnet **native ETH** from a Trezo-operated treasury EOA (`TREASURY_PRIVATE_KEY`) to the user's wallet on a verified `completed`. Gated by `TESTNET_DEMO_FULFILLMENT=true`, `TRANSAK_ENV != PRODUCTION`, a known-testnet chainId allowlist (84532/11155111/421614), and a per-order `TESTNET_DEMO_MAX_ETH` cap so a verified order can't drain the treasury.
- Both triggers route through one shared `fulfillCompletedOrder(order)`: `chainId 31337 →` `LocalFulfillmentService` (Anvil); known testnet `→ TestnetFulfillmentService`; **mainnet `→` no fulfillment** (Transak delivered the real asset; we only record its `tx_hash`).

This reuses the server-EOA pattern already accepted for recovery (ADR-0010).

## Why

- **The on-ramp can't be "made to work end-to-end" in the literal sense on testnet — that's a Transak constraint, not ours.** The honest, demoable design separates the two things "completion" conflates: *payment verification* (real Transak flow, cryptographically verified) and *fund delivery* (subsidised by us on testnet, by Transak on mainnet). Both reuse the same verification plumbing.
- **A funded edge function that moves money on a webhook trigger is a faucet.** It is only safe if the trigger is unforgeable. Signature verification is therefore a hard prerequisite for the "fund from our EOA" idea — not an alternative to it.
- **Validated, not assumed:** the refresh-token endpoint + response shape were confirmed live against `api-stg.transak.com` with the project's staging credentials, and the HS256/access-token verify scheme was proven with a standalone zero-dependency Node test (`_shared/ramp/jwt-verify.proof.mjs`).

## Considered alternatives

- **Keep trusting the client `notifyWebhook`.** Rejected: spoofable; lets anyone complete any order and (with fulfillment on) drain the treasury.
- **Webhook-only (no pull-verify).** Rejected as the primary path: staging webhook *delivery* can't be proven without a live order, registration is an extra manual step, and it depends on Transak reaching us. Kept as a secondary/redundant path. Pull-verify was confirmed live (the Order Status API works in staging with our credentials) and adopted as primary.
- **Accept the `TRNSK` test token as "delivered."** Rejected for the demo: it's the wrong asset and a confusing story; native-ETH grant reads as a real "you bought ETH, here it is."
- **ERC-20 (testnet USDC) grant now.** Deferred: needs the treasury to hold testnet USDC + a token-transfer path. v1 grants native ETH (per product decision); the service is structured to add ERC-20 later.

## Consequences

### Operational
- Deploy three functions: `onramp-session`, `verify-onramp-order` (primary), `onramp-webhook` (secondary).
- New Supabase secrets (cloud project, since the device app hits cloud functions): `TRANSAK_ENV=STAGING`, `RAMP_PROVIDER=transak`, `TRANSAK_STAGING_API_KEY`, `TRANSAK_API_SECRET`, `TRANSAK_REFERRER_DOMAIN`, `TESTNET_DEMO_FULFILLMENT=true`, `TREASURY_PRIVATE_KEY`, optional `BASE_SEPOLIA_RPC_URL`, `TESTNET_DEMO_MAX_ETH` (default 0.01).
- Registering the webhook URL is **optional** (the pull path completes orders without it). Register it only to exercise the redundant push path.
- The treasury EOA must be funded with Base Sepolia ETH (faucet) — you can reuse the already-funded `RECOVERY_RELAYER_PRIVATE_KEY`. At a 0.01-ETH cap, a small drip covers many demos.

### Security
- `verify_jwt = false` stays (Transak can't send a Supabase JWT); the JWT signature check is the gate. Forged/unsigned calls can no longer complete an order or move funds.

### Mainnet (future capability, likely never run)
- Flip `TRANSAK_ENV=PRODUCTION`: treasury fulfillment hard-gates off, Transak delivers the purchased asset to the wallet, and the verified webhook simply records the `tx_hash`. Same verification code path.

## Related
- ADR-0010 — Trezo-operated server EOA performing on-chain actions via edge function (same pattern, recovery context)
- `docs/plans/2026-05-02-on-ramp-integration.md` — original plan (Task 6 / Task 11 = "verify signature")
- `docs/transak-onramp-demo.md` — operator runbook (secrets, webhook registration, treasury funding, demo steps)
- `apps/backend/supabase/functions/_shared/ramp/` — TransakProvider, TestnetFulfillmentService, status, tests
- `apps/backend/supabase/functions/onramp-webhook/index.ts`
