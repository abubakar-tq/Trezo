# Transak On-Ramp — Demo Runbook (testnet)

How to take the verified Transak on-ramp from code to a working demo where **real
Base Sepolia ETH lands in the user's wallet**. See `docs/decisions/0012` for the why.

---

## ⚡ Quick start (this project) — do these in order

Only **3 things are yours to supply**: (a) the Transak **API secret**, (b) a funded
**treasury key**, (c) your **Supabase project ref**. Everything else is filled in.

> **Treasury shortcut:** reuse your existing `RECOVERY_RELAYER_PRIVATE_KEY` — it's
> already a Base-Sepolia-funded Trezo EOA (ADR-0010). No new wallet, no faucet.
> (Or use any other key holding Base Sepolia ETH.)

**1. Find your project ref** — it's the subdomain in `apps/mobile/.env` →
`EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co` (or `supabase projects list`).

**2. Set the cloud secrets** (run from `apps/backend/supabase`; swap in your secret + treasury key).
First link the CLI to the project if you haven't: `supabase link --project-ref <PROJECT_REF>`.
```bash
supabase secrets set \
  RAMP_PROVIDER=transak \
  TRANSAK_ENV=STAGING \
  TRANSAK_STAGING_API_KEY=312789a1-4d44-48ac-aa5e-56b7c5fa91b8 \
  TRANSAK_API_SECRET=<YOUR_API_SECRET> \
  TRANSAK_REFERRER_DOMAIN=trezo.app \
  TESTNET_DEMO_FULFILLMENT=true \
  TREASURY_PRIVATE_KEY=<YOUR_FUNDED_BASE_SEPOLIA_KEY> \
  TESTNET_DEMO_MAX_ETH=0.01
```

**3. Deploy the functions:**
```bash
supabase functions deploy onramp-session
supabase functions deploy verify-onramp-order   # PRIMARY completion path (pull-verify)
supabase functions deploy onramp-webhook        # secondary/redundant push path
```

**4. (Optional) Register the webhook** — NOT required; the app completes orders via
the pull path in step 5. Register it only to exercise the redundant push path, in
`dashboard.transak.com → Developers → Webhooks`:
`https://<PROJECT_REF>.supabase.co/functions/v1/onramp-webhook`

**5. Run the app on Base Sepolia and buy ETH.** In `apps/mobile/.env` set
`EXPO_PUBLIC_RAMP_MODE=transak` and `EXPO_PUBLIC_DEFAULT_CHAIN_ID=84532`, launch on
your device (the `run-mobile` skill / `npm run android`), open **Buy Crypto**, enter
an amount, and pay with the staging test card below. The app calls `verify-onramp-order`,
which asks Transak for the real status and — on COMPLETED — the treasury credits your
wallet. The screen flips to success within a few polls.

Verify it worked: `supabase functions logs verify-onramp-order` shows
`fetchOrderStatus … status: ORDER_COMPLETED` then `[TestnetFulfillment] ✅ Sent: 0x…`,
and the wallet balance goes up. Still "processing"? Transak hasn't marked the order
COMPLETED yet — keep the screen open; the poll loop re-verifies every few seconds.

> **Test the pull path without the app** (after paying a test order), run the harness
> with the order's `partnerOrderId` (your `ramp_orders` UUID):
> ```bash
> TRANSAK_STAGING_API_KEY=… TRANSAK_API_SECRET=… \
>   node apps/backend/supabase/functions/_shared/ramp/pull-verify.proof.mjs <partnerOrderId>
> ```

The rest of this doc explains each step in depth.

---

## The one thing to understand first

Transak's **staging never delivers the real asset** to your wallet (native ETH →
nothing; ERC-20 → a `TRNSK` test token). So the demo is two cooperating halves:

1. **Payment is real + verified** — the user pays in the real Transak staging
   widget; our backend then asks Transak directly (keyed by our `partnerOrderId`)
   for the order's real status. Unforgeable, and needs no webhook. (A signed-webhook
   push path also exists as redundancy.)
2. **Funds are delivered by us** — on a *verified* completion, a Trezo treasury
   EOA sends real Base Sepolia ETH to the user's wallet.

On mainnet (future), half 2 turns off and Transak itself delivers — same verification code.

## Prerequisites

- Transak partner account → `dashboard.transak.com` → **Developers**: API **key** + API **secret**.
- A treasury EOA (any fresh keypair) funded with Base Sepolia ETH from a faucet.
- Supabase CLI logged in to the project the mobile app actually talks to (cloud).

## 1. Set the cloud Supabase secrets

The device app hits the **cloud** edge functions, so secrets go on the cloud project
(not just `.env.local`). From `apps/backend/supabase`:

```bash
supabase secrets set \
  RAMP_PROVIDER=transak \
  TRANSAK_ENV=STAGING \
  TRANSAK_STAGING_API_KEY=<your-api-key> \
  TRANSAK_API_SECRET=<your-api-secret> \
  TRANSAK_REFERRER_DOMAIN=trezo.app \
  TESTNET_DEMO_FULFILLMENT=true \
  TREASURY_PRIVATE_KEY=0x<funded-base-sepolia-key> \
  TESTNET_DEMO_MAX_ETH=0.01
```

Then deploy the functions:

```bash
supabase functions deploy onramp-session
supabase functions deploy onramp-webhook
```

> `onramp-webhook` is intentionally public (`verify_jwt = false` in `config.toml`) —
> Transak can't present a Supabase JWT. The **JWT signature check is the gate**.
>
> `TRANSAK_REFERRER_DOMAIN` is **required** by the Create Widget URL API. Staging
> accepts any value; for production it must be a domain whitelisted in the Transak
> dashboard, or the widget URL call fails with `referrerDomain is required` / 4xx.

## 2. Register the webhook URL in Transak

Dashboard → **Developers → Webhooks** → add:

```
https://<project-ref>.functions.supabase.co/onramp-webhook
```

**This step is mandatory.** Completion is now authoritative-only: without the
registered webhook, Transak never tells us the order completed, so the order never
completes and no funds are granted. (The mobile client's old "nudge" is deliberately
ignored — it returns HTTP 202 and changes nothing.)

## 3. Fund the treasury EOA

Send Base Sepolia ETH to the `TREASURY_PRIVATE_KEY` address from a faucet. At a
`TESTNET_DEMO_MAX_ETH=0.01` cap, ~0.05 ETH covers many demo runs. If the treasury
runs dry, fulfillment logs `❌ Failed` and the order stays `completed` without a grant.

## 4. Mobile config

Ensure the app targets Base Sepolia and the Transak provider:

```
EXPO_PUBLIC_RAMP_MODE=transak        # or "auto" (Anvil→mock, everything else→transak)
EXPO_PUBLIC_DEFAULT_CHAIN_ID=84532   # Base Sepolia (or pick it in the Buy screen)
```

## 5. Run the demo

1. Open **Buy Crypto**, pick **Base Sepolia**, asset **ETH**, enter an amount, tap Buy.
2. In the widget, pay with the staging test card shown in the banner:
   **`4242 4242 4242 4242` · exp `10/33` · CVV `100` · 3-D Secure password `Checkout1!`**.
3. Complete Transak's flow. Transak fires `ORDER_COMPLETED` → `onramp-webhook`.
4. The function verifies the JWT, marks the order, and the treasury sends ETH.
5. The Buy screen (polling `ramp_orders` every 3s) flips to success; the wallet
   balance reflects the granted ETH.

## What to expect in the function logs

- `Fetched Partner Access Token (expires …)` — refresh-token call succeeded.
- `Webhook JWT signature verified ✅` — a genuine Transak event.
- `[TestnetFulfillment] ✅ Sent: 0x…` — the grant tx hash (stored as `local_fulfillment_tx_hash`).
- `Rejecting UNVERIFIED signed webhook` (401) — bad/expired signature; Transak will retry.
- `Ignoring unverified client nudge` (202) — the harmless client hint; expected, no action.

## Tests

```bash
# Pure status mapping + fulfillment guard matrix (needs deno / supabase toolchain)
deno test apps/backend/supabase/functions/_shared/ramp/status.test.ts
deno test --allow-net --allow-env apps/backend/supabase/functions/_shared/ramp/fulfillment.test.ts

# Zero-dependency proof of the HS256 / access-token verify scheme (Node)
node apps/backend/supabase/functions/_shared/ramp/jwt-verify.proof.mjs
```

## Limitations / honesty notes

- The delivered ETH is a **Trezo testnet grant**, not Transak-delivered crypto —
  unavoidable on staging. The amount is a capped subsidy, not the purchased quantity.
- v1 grants **native ETH only**, regardless of the asset selected. ERC-20 (testnet
  USDC) grants are future work (treasury would hold the token + do an ERC-20 transfer).
- For mainnet: set `TRANSAK_ENV=PRODUCTION`. Treasury fulfillment self-disables and
  Transak delivers the real purchased asset; the verified webhook just records `tx_hash`.
