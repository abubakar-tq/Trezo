# HANDOFF — Receive Notifications + On-Chain Indexer

> **If you're a teammate driving Claude Code: read this entire file first, then start at "Your first move." It is the source of truth. Do not re-derive the architecture or re-debug the hosting — the hard lessons are in "Critical gotchas," and skipping them will cost you hours.**

**Branch with all the work:** `feat/receive-notifications-indexer` (pushed to `origin`, GitHub `abubakar-tq/Trezo`).
You are currently reading this from that branch. The matching local-only plan docs (`docs/plans/2026-05-29-{indexer-base-sepolia-notifications,android-fcm-push,stablecoin-peg-price-source}.md`) are **git-ignored** — ask the repo owner for them if you want the granular task breakdowns, but **this file is self-contained.**

---

## Your first move
```bash
git checkout feat/receive-notifications-indexer && git pull
```
Then read "What's done" and "Remaining work." The **code is complete**; what's left is **deployment + setup**, most of which needs accounts/secrets only the owner has.

---

## TL;DR status

| Area | State |
|---|---|
| **Indexer code** (Plan 1) | ✅ **100% complete & verified booting locally.** Needs a host. |
| **Stablecoin peg + price source** (Plan 3) | ✅ **Code complete.** Needs a 1-min on-device check. |
| **FCM / OS push** (Plan 2) | ⬜ Not started — Firebase + EAS console work + 1 config line. |
| **Indexer hosting** | ⬜ **The main blocker.** Render free does NOT work (see gotchas). Use Oracle free VM or Railway. |
| **Supabase migration** | ⬜ Must be applied before the indexer goes live. |

---

## What the feature does (architecture)

The user reported: *received money → no notification (in-app or OS), nothing in Recent Activity; also a Firebase error and a jittery balance.*

Root cause for the receive issues: **balance is read live from RPC, but Recent Activity / in-app notifications / push all come from a separate pipeline that only worked on local Anvil — it never watched the hosted testnets.**

The fix ("Approach B"):
- A **Ponder indexer** (`apps/backend/indexer`, Ponder v0.11.44) watches **Base Sepolia (84532)** + **Ethereum Sepolia (11155111)** (Arbitrum Sepolia 421614 is wired but dormant until deployed). It uses **Neon Postgres** for its own state and writes user-facing rows **directly into Supabase `wallet_transactions`** (and `account_security_events`). There is **no separate sync-worker** — it was retired; all handlers write to Supabase directly.
- Supabase has a trigger (`fn_emit_notification_from_wallet_tx`) that turns those rows into `notifications`, which drive the **in-app notification** + the **`send-push-notification` edge function** (OS push).
- What it indexes: incoming **ERC-20** + **native ETH** receives, **security events** (recovery/guardians/passkey/module), and a **UserOp-confirmation backstop** for outgoing txs.
- The **mobile side** (Supabase reads, ActivityFeed "Received" display, the whole notification pipeline) is unchanged and shared.

Key design points (don't undo these):
- Native ETH receives use Ponder's `accounts` primitive with a `factory()` address source + a `KnownAccounts:transaction:to` handler (no trace API needed → works on Infura free).
- ERC-20 is restricted to **known token contracts per chain** (USDC/WETH/LINK from the registry) for volume control — indexing *all* Transfers on live testnets would be millions of logs and blow small-RAM hosts.
- Contract addresses are **portable** (same on every chain) and **baked into `src/addresses.ts`** as env-overridable defaults; deploy blocks too (Base 41380204, Eth 10945815).

---

## ⚠️ Critical gotchas (read before deploying — these are the expensive lessons)

1. **Render free CANNOT host this. Do not try.** `ponder start` gets **OOM-killed** on Render free's 512 MB cap during build/sync warm-up — a **silent SIGKILL**: the deploy logs show only the telemetry line then "Exited with status 1", *nothing even at `PONDER_LOG_LEVEL=trace`*. Capping the V8 heap (`--max-old-space-size`) does **not** help (the overage is native/total RSS). Render's paid **Starter ($7) is also 512 MB** → won't help. Render free also **spins down after 15 min idle**, which is wrong for an always-on indexer regardless. **Host it somewhere with ≥ ~1 GB RAM** (Oracle free VM = 24 GB, or Railway).
2. **Node must be 20.** Pinned via `engines` (`>=20.19 <21`) in the indexer `package.json`. On **Node 24**, Ponder's fetch throws `Failed to find Response internal state key` and the process dies. Keep Node 20. (On Node < 22 there's no native `WebSocket`, which is why we add a `ws` transport — see #3.)
3. **supabase-js needs a `ws` realtime transport on Node < 22.** Already wired in `src/lib/supabase.ts` (`realtime: { transport: ws }`). Without it, `createClient` throws `Node.js 20 detected without native WebSocket support`. The `ws` dep is in `package.json`.
4. **`ponder start` requires `src/api/index.ts`** (a Hono app) — it's present (minimal liveness route). Ponder also serves its own `/health` (200) which Render/Oracle/Railway health checks + keep-alive can hit.
5. **The deployment JSON files (`contracts/deployments/*.json`) are NOT in git.** `src/addresses.ts` is tolerant of their absence (`loadDeployment` try/catches → `null`) and **Anvil is auto-omitted** when `31337.json` is missing (i.e., on any fresh clone / host). Testnet addresses are baked in, so the indexer runs fine without those files.
6. **Use OUR env-var names** (not Ponder's generic `PONDER_RPC_URL_<chainId>`): `PONDER_BASE_SEPOLIA_RPC_URL`, `PONDER_ETH_SEPOLIA_RPC_URL`, `DATABASE_URL`, `DATABASE_SCHEMA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. These are read in `src/addresses.ts` / `ponder.config.ts` / `src/lib/supabase.ts`.
7. **Monorepo install:** build with `npm install --no-workspaces` from `apps/backend/indexer` (installs only the indexer's deps, not the whole monorepo). It's an **npm-workspaces** repo (NOT pnpm).

---

## Environment variables (get the secret VALUES from the repo owner)

Set these wherever you host (and in `apps/backend/indexer/.env.local` for local runs — Ponder auto-loads it):

```
DATABASE_URL=<Neon Postgres URL, ap-southeast-1/Singapore, include ?sslmode=require>   # owner has it
DATABASE_SCHEMA=indexer_v1
PONDER_BASE_SEPOLIA_RPC_URL=https://base-sepolia.infura.io/v3/<INFURA_KEY>   # ensure "Base" is enabled on the key
PONDER_ETH_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/<INFURA_KEY>
SUPABASE_URL=https://jhjnybcscdwpbnztzozy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase service-role key>   # in apps/mobile/.env as SUPABASE_SERVICE_ROLE; NEVER expose client-side
# Arbitrum Sepolia: leave UNSET until contracts are deployed there (the chain is auto-omitted).
```
The owner's existing values live in `apps/mobile/.env` (Infura key = `EXPO_PUBLIC_SEPOLIA_RPC_URL`; service role = `SUPABASE_SERVICE_ROLE`) and the Neon URL was shared directly. **Do not commit real secrets.**

---

## Verify the indexer locally (do this first — proves your env is right)
From `apps/backend/indexer`:
```bash
npm install --no-workspaces
# put the env vars above into a .env.local (use DATABASE_SCHEMA=indexer_diag for a throwaway local run)
npx ponder codegen
npx ponder start --port 42069
```
**Expected (success):** `Using Postgres database …` → `Created tables […]` → `Started listening on port 42069` → `Started returning 200 responses from /health endpoint` → `Started 'baseSepolia'/'ethSepolia' historical sync`. If you see that, the code + env are correct and it's purely a hosting exercise. (Ctrl-C to stop. Drop the throwaway `indexer_diag` schema in Neon afterward.)

---

## Remaining work (ordered)

### Task A — Host the indexer  ⟵ the main blocker
**Recommended: Oracle Cloud "Always Free" Ampere A1 VM, region = Singapore (co-located with Neon + Supabase). $0 forever, plenty of RAM, always-on.**
1. cloud.oracle.com → sign up (card for identity only). **Home region = Singapore** (can't change later).
2. Create Instance → Ubuntu 22.04 → shape **VM.Standard.A1.Flex**, 2 OCPU / 12 GB (within the free 4-OCPU/24 GB cap) → add SSH key. (If "Out of host capacity": retry, or briefly switch to Pay-As-You-Go — still $0 under free limits.)
3. **Open port 42069 on BOTH layers** (the #1 missed step): VCN → Subnet → Security List → Ingress `0.0.0.0/0` TCP 42069; then on the box: `sudo iptables -I INPUT -p tcp --dport 42069 -j ACCEPT && sudo netfilter-persistent save`.
4. Install + run:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs git
   git clone -b feat/receive-notifications-indexer https://github.com/abubakar-tq/Trezo.git
   cd Trezo/apps/backend/indexer && npm install --no-workspaces
   # create .env.local with the env vars above (DATABASE_SCHEMA=indexer_v1)
   ```
5. Run always-on under systemd:
   ```bash
   sudo tee /etc/systemd/system/ponder.service >/dev/null <<'EOF'
   [Unit]
   After=network-online.target
   Wants=network-online.target
   [Service]
   WorkingDirectory=/home/ubuntu/Trezo/apps/backend/indexer
   ExecStart=/home/ubuntu/Trezo/apps/backend/indexer/node_modules/.bin/ponder start --hostname 0.0.0.0 --port 42069
   Restart=always
   RestartSec=5
   User=ubuntu
   [Install]
   WantedBy=multi-user.target
   EOF
   sudo systemctl daemon-reload && sudo systemctl enable --now ponder && journalctl -u ponder -f
   ```
   The VM never sleeps, so no keep-alive pinger is needed (point UptimeRobot at `http://<VM-IP>:42069/health` for *alerting* only).

**Fallback (less ops, ~$5/mo): Railway.** New Project → Deploy from `abubakar-tq/Trezo`, branch `feat/receive-notifications-indexer` → Settings: Root Directory `apps/backend/indexer`, Build `npm install --no-workspaces`, Start `ponder start --hostname 0.0.0.0 --port $PORT` → add the env vars → Networking → Generate Domain. Railway doesn't sleep Hobby services.

### Task B — Apply the Supabase migration  (do before/with Task A going live)
The indexer upserts incoming transfers keyed on `(chain_id, transaction_hash, log_index)`; **without this column + index, every insert errors.** File: `apps/backend/supabase/migrations/20260601020000_wallet_tx_indexer_dedup.sql` (on this branch). Apply via `supabase db push` (if linked) or paste into Supabase SQL editor:
```sql
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS log_index INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_indexer_dedup_idx
  ON public.wallet_transactions (chain_id, transaction_hash, log_index)
  WHERE direction = 'incoming' AND transaction_hash IS NOT NULL AND log_index IS NOT NULL;
```

### Task C — Stablecoin/price on-device check  (code already shipped on this branch)
Get a free CoinGecko demo key (coingecko.com/en/api), set `EXPO_PUBLIC_COINGECKO_API_KEY` in `apps/mobile/.env`, run the app. Confirm: balance holds at **$20.00** (no $19.99↔$20.01 jitter) and the `[MarketService] CoinCap … failure` log is gone.

### Task D — FCM / OS push (Plan 2) — fixes the `Default FirebaseApp is not initialized` error
Mostly Firebase + EAS console work:
1. Firebase Console → new project → add **Android app**, package `com.trezo.wallet` → download `google-services.json` → put at `apps/mobile/google-services.json`.
2. In `apps/mobile/app.config.ts`, add to the `android` block: `googleServicesFile: "./google-services.json"`. (Not added yet — it would break native builds while the file is absent.)
3. Firebase → Project Settings → Service Accounts → **Generate new private key** (FCM V1 JSON).
4. `eas credentials` → Android → your profile → **Google Service Account → upload** that JSON. (Legacy FCM keys are dead; V1 is required.)
5. `eas build --profile development --platform android` → install on a **physical** Android device (emulators can't mint FCM tokens reliably). OTA won't apply native changes.
   - Note: OS push for *receives* only fully fires once Task A + B are live (push rides the same `notifications` rows). This step still clears the Firebase error and makes the token work.

---

## End-to-end acceptance test (after A + B live)
Send testnet USDC (and native ETH) to a deployed smart wallet → within ~1 block it should appear in **Recent Activity** as "Received +X USDC" + fire an **in-app notification** (+ **OS push** once Task D is done). Native ETH and ERC-20 both work; the `confirmed_at` and amounts should be correct (USDC shows real 6-decimal amounts, symbol "USDC").

---

## Reference / context
- Indexer code: `apps/backend/indexer/` — `ponder.config.ts` (multi-chain, env-gated), `src/addresses.ts` (baked addresses + ACTIVE_TESTNET_CHAINS), `src/handlers/*` (erc20Inbound, nativeInbound, socialRecovery, smartAccount, entryPoint, accountFactory), `src/lib/*` (supabase, networkKeys, tokenMeta, projectTransfer, projectSecurityEvent, projectUserOpConfirmation), `src/api/index.ts`.
- Mobile changes (Plan 3): `src/features/assets/config/tokenRegistry.ts` (isStablecoinAddress), `src/features/portfolio/services/PriceProvider.ts` (peg), `src/services/MarketService.ts` (CoinGecko), `src/features/home/components/dashboard/{ActivityFeed,MarketExplorer}.tsx`.
- Notification trigger: `apps/backend/supabase/migrations/20260505010000_notification_triggers.sql`.
- Don't waste time re-attempting Render free, re-deriving the multi-chain config, or rebuilding the sync-worker — all settled. If the indexer won't boot on a host, it's almost always (a) wrong/missing env var, (b) Node ≠ 20, or (c) < 1 GB RAM.
