# Trezo On-Ramp Integration (FYP)

This document explains the technical implementation of the On-Ramp system, which bridges fiat payments (Transak) with our local development environment (Anvil).

## Architecture Overview

Trezo uses a **Provider Abstraction** layer to handle on-ramp orders. The system supports three main modes:

1.  **Local Mock Mode:** Completely simulated. No external APIs are called.
2.  **Transak Staging Mode:** Uses Transak's sandbox for real fiat flow testing on public testnets.
3.  **Hybrid Demo Mode:** A bridge where a real Transak staging order triggers local funding on Anvil after completion.

### Why Hybrid Mode?
Transak cannot fund `localhost:8545` (Anvil) directly. Hybrid mode allows you to demo the entire flow:
1. User pays with fiat in Transak Staging (Public Testnet).
2. Trezo Backend receives the webhook.
3. Trezo Backend mirrors those funds by minting/sending mock funds to the user's wallet on the **Local Anvil** chain.
4. User can immediately use those funds for recovery/swap demos on the local Trezo contracts.

---

## Environment Configuration

| Variable | Description | Example |
| :--- | :--- | :--- |
| `RAMP_PROVIDER` | `mock` or `transak` | `mock` |
| `LOCAL_DEV_FULFILLMENT` | Enable/Disable Anvil funding | `true` |
| `TRANSAK_ENV` | `STAGING` or `PRODUCTION` | `STAGING` |
| `ANVIL_RPC_URL` | Local node address | `http://127.0.0.1:8545` |
| `LOCAL_FUNDER_PRIVATE_KEY` | Anvil account with ETH | `0x...` |

---

## Demo Steps

### A. Local Mock Demo (Fastest)
1. Ensure Anvil is running.
2. Set `RAMP_PROVIDER=mock` and `LOCAL_DEV_FULFILLMENT=true`.
3. Open Trezo Mobile.
4. Go to **Wallet > Buy**.
5. Enter an amount and click **Buy**.
6. Click **Complete Mock Order** in the status card.
7. Observe the status change and check your local wallet balance.

### B. Transak Staging Demo
1. Set `RAMP_PROVIDER=transak`.
2. Ensure you have a Transak Staging API Key.
3. Click **Buy** in the app. The Transak widget will open.
4. Complete the sandbox payment (choose a supported staging asset like `POLYGON`).
5. Wait for the webhook to hit your backend (using Ngrok or similar if local).

---

## Technical Details

- **Database:** `ramp_orders` table tracks lifecycle.
- **Backend:** Supabase Edge Functions (`onramp-session`, `onramp-webhook`).
- **Blockchain:** `LocalFulfillmentService` uses `viem` for RPC calls.
- **Security:** Production guards prevent `LocalFulfillmentService` from running outside of dev/staging environments.
