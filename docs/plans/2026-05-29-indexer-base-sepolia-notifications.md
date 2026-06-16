# Indexer → Base Sepolia + Receive Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on testing:** The `apps/backend/indexer` package has **no test runner** (scripts: `dev`, `start`, `codegen`, `worker:sync`). Per "follow established patterns," verification steps use `npx tsc --noEmit`, Ponder's `/status` endpoint, `curl`, and an end-to-end on-device check — not fabricated unit tests. Pure-logic helpers include a runnable `node`/`tsx` assertion script where useful.

**Goal:** Make incoming ERC-20 and native ETH transfers on **every deployed testnet** appear in Recent Activity and fire in-app + push notifications, by extending the existing Ponder indexer to index all our chains and writing user-facing rows **directly into Supabase `wallet_transactions`** (eliminating the separate `sync-worker`), deployed for **$0** on Render free + Neon.

**Chains (one service indexes all):**
- **Base Sepolia** (84532) — deployed, active.
- **Ethereum Sepolia** (11155111) — deployed, active.
- **Arbitrum Sepolia** (421614) — **not yet deployed**; wired but **env-gated** (a chain/contract is only included when its RPC + address env vars are set, mirroring `apps/mobile/src/integration/networks.ts` `isEnabled`). Activates automatically once deployed.
- (Local `anvilLocal` 31337 stays as-is for local dev.)

**Architecture (locked — "Approach B"):** One always-on Ponder service (`ponder start`) on **Render free Web Service**, using **Neon** as Ponder's own Postgres (`indexer_v1` schema). Ponder indexing handlers write the user-facing projection **directly** into the existing **Supabase** `wallet_transactions` table using the service-role key; the existing Supabase DB trigger (`fn_emit_notification_from_wallet_tx`) then creates `notifications` rows that drive the in-app feed and the `send-push-notification` edge function. Native ETH receives use Ponder's `accounts` primitive with a `factory()` address source (no manual block iteration, no in-memory registry). A free uptime pinger hits `/health` to defeat the 15-min spin-down.

**ERC-20 volume control (critical for multi-chain on free tier):** the ERC-20 source is restricted to the **known token contract addresses per chain** (from `tokenRegistry` — USDC/WETH/LINK), NOT all Transfer events on the chain. Indexing every Transfer across three live testnets would be millions of logs and exceed 512 MB + the Alchemy free CU budget. The handler then keeps the `isKnownAccount` recipient filter. (Optional tighter optimization to verify during implementation: `filter: { event: "Transfer", args: { to: factory(...) } }` to catch *any* token sent to our accounts — `factory()`-as-args-filter was not confirmed in the grilled docs, so the token-address-list filter is the default.)

**Tech Stack:** Ponder ^0.11.44, viem, `@supabase/supabase-js`, Neon Postgres, Render, Alchemy Base Sepolia RPC.

**Why this shape (verified during grill):**
- Ponder `accounts` config "index transactions or native transfers... Supports indexing multiple addresses or **factory contracts**" — so native inbound = `accounts` sourced from the AccountFactory `AccountCreated` event + a `transfer:to` handler. (ponder.sh/docs accounts)
- `ponder start` runs the indexer + an HTTP server on port `42069` (override with `PORT`/`-p`), exposes `GET /health` (liveness) and `GET /status` (per-chain `ready` + latest block). Render `healthCheckPath` must return 2xx/3xx — `/health` qualifies.
- Reorg semantics: Ponder reverts **its own** `context.db` tables on reorg, but **external** Supabase writes are side effects that are NOT auto-reverted → we use idempotent upserts keyed on `(chain_id, transaction_hash, log_index)` + a confirmation-depth guard. Base Sepolia reorgs are shallow/rare.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/backend/indexer/ponder.config.ts` | Add `baseSepolia` chain + per-chain contract addresses + `accounts` (factory) for native receives | Modify |
| `apps/backend/indexer/src/addresses.ts` | Add Base Sepolia address constants (env-driven) | Modify |
| `apps/backend/indexer/src/lib/supabase.ts` | Service-role Supabase client for the indexer process | Create |
| `apps/backend/indexer/src/lib/networkKeys.ts` | `chainId → network_key` map (adds 84532) | Create |
| `apps/backend/indexer/src/lib/tokenMeta.ts` | Resolve `{symbol, decimals}` for a token: registry first, on-chain `symbol()/decimals()` fallback, in-memory cache | Create |
| `apps/backend/indexer/src/lib/projectTransfer.ts` | Idempotent upsert of an incoming transfer into Supabase `wallet_transactions` | Create |
| `apps/backend/indexer/src/handlers/erc20Inbound.ts` | Write incoming ERC-20 to Supabase (replaces sync-worker poller path) | Modify |
| `apps/backend/indexer/src/handlers/nativeInbound.ts` | Native ETH `transfer:to` handler → Supabase (currently an empty placeholder) | Rewrite |
| `apps/backend/supabase/migrations/2026MMDD000000_wallet_tx_indexer_dedup.sql` | Add `log_index` + partial unique index for indexer idempotency | Create |
| `apps/backend/indexer/render.yaml` | Render Web Service definition | Create |
| `apps/backend/indexer/.env.example` | Document new env vars | Create/Modify |
| `apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx` | Direction-aware label + icon for incoming | Modify |

**Phasing:** Phase 1 (Tasks 1–8) delivers the reported fix end-to-end (receive → activity + notification). Phase 2 (Tasks 9–10) ports the remaining `sync-worker` streams (security events, UserOp confirmation backstop) into the handler-writes-Supabase model so the standalone worker can be retired.

---

## Task 0: Provision external accounts (ops — developer only)

- [ ] **Step 1: Neon** — Create a free Neon project. Copy the **pooled** connection string (host contains `-pooler`), append `?sslmode=require`. This is `DATABASE_URL`.
- [ ] **Step 2: Alchemy** — One free Alchemy account covers all networks (shared 30M CU/month). Record one RPC URL per **deployed** chain:
  - Base Sepolia → `PONDER_BASE_SEPOLIA_RPC_URL` = `https://base-sepolia.g.alchemy.com/v2/<KEY>`
  - Ethereum Sepolia → `PONDER_ETH_SEPOLIA_RPC_URL` = `https://eth-sepolia.g.alchemy.com/v2/<KEY>`
  - Arbitrum Sepolia → `PONDER_ARB_SEPOLIA_RPC_URL` = `https://arb-sepolia.g.alchemy.com/v2/<KEY>` (set later, when deployed)
  - (Public RPCs like `sepolia.base.org` rate-limit `eth_getLogs` backfill — do not use them.)
- [ ] **Step 3: Source contract addresses + factory deploy block per chain** — From the deployments the mobile app already uses (`getDeployment("base-sepolia")`, `getDeployment("sepolia")`, and later `getDeployment("arb-sepolia")`). For each deployed chain record: `accountFactory`, `socialRecovery`, `passkeyValidator`, EntryPoint v0.7 (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`), and the **AccountFactory deploy block** (the per-chain `*_START_BLOCK`). Arbitrum Sepolia: skip until deployed — its env vars stay unset and the indexer omits that chain.
- [ ] **Step 4: Supabase** — From the Trezo Supabase project settings: record `SUPABASE_URL` and the **service role** key (`SUPABASE_SERVICE_ROLE_KEY`). Never expose these in `EXPO_PUBLIC_*`.

No code change. No commit.

---

## Task 1: Add `log_index` + idempotency index to `wallet_transactions`

**Files:**
- Create: `apps/backend/supabase/migrations/2026MMDD000000_wallet_tx_indexer_dedup.sql` (use today's date + a time suffix greater than existing migrations)

- [ ] **Step 1: Write the migration**

```sql
-- Indexer idempotency: an incoming on-chain transfer is uniquely identified by
-- (chain_id, transaction_hash, log_index). Native transfers use log_index = -1.
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS log_index INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_indexer_dedup_idx
  ON public.wallet_transactions (chain_id, transaction_hash, log_index)
  WHERE direction = 'incoming' AND transaction_hash IS NOT NULL AND log_index IS NOT NULL;
```

- [ ] **Step 2: Apply locally and verify**

Run: `supabase db push` (or `psql "$DATABASE_URL_SUPABASE" -f <file>` against a dev DB).
Expected: no error; `\d public.wallet_transactions` shows `log_index` and the new unique index.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/supabase/migrations/2026MMDD000000_wallet_tx_indexer_dedup.sql
git commit -m "feat(supabase): add indexer dedup index to wallet_transactions"
```

---

## Task 2: Supabase client + network-key map for the indexer

**Files:**
- Create: `apps/backend/indexer/src/lib/supabase.ts`
- Create: `apps/backend/indexer/src/lib/networkKeys.ts`

- [ ] **Step 1: Create the Supabase client**

`apps/backend/indexer/src/lib/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error("[indexer] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

// Service role bypasses RLS — required because indexer rows are written on
// behalf of users without an auth session.
export const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 2: Create the network-key map**

`apps/backend/indexer/src/lib/networkKeys.ts`:
```typescript
// Mirrors apps/mobile/src/integration/networks.ts NetworkKey values.
export const CHAIN_ID_TO_NETWORK_KEY: Record<number, string> = {
  31337: "anvil-local",
  8453: "base-mainnet-fork",
  84532: "base-sepolia",
  11155111: "ethereum-sepolia",
  421614: "arbitrum-sepolia",
};

export function networkKeyForChain(chainId: number): string | null {
  return CHAIN_ID_TO_NETWORK_KEY[chainId] ?? null;
}
```

- [ ] **Step 3: Add `@supabase/supabase-js` dependency**

Run: `pnpm --filter trezo-indexer add @supabase/supabase-js`
Expected: added to `apps/backend/indexer/package.json` dependencies.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/backend/indexer`
Expected: PASS (no errors from the two new files).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/indexer/src/lib/supabase.ts apps/backend/indexer/src/lib/networkKeys.ts apps/backend/indexer/package.json pnpm-lock.yaml
git commit -m "feat(indexer): supabase service client + network-key map"
```

---

## Task 3: Token metadata resolver (registry + on-chain fallback)

**Files:**
- Create: `apps/backend/indexer/src/lib/tokenMeta.ts`

Fixes the hardcoded `token_symbol: "ERC20"` / `token_decimals: 18` bug. USDC on Base Sepolia is `0x036CbD53842c5426634e7929541eC2318f3dCF7e` with **6** decimals.

- [ ] **Step 1: Implement the resolver**

`apps/backend/indexer/src/lib/tokenMeta.ts`:
```typescript
import { erc20Abi, getAddress, type Address } from "viem";

export interface TokenMeta { symbol: string; decimals: number; }

// Known tokens per chain (mirror of mobile tokenRegistry for the chains we index).
const KNOWN: Record<number, Record<string, TokenMeta>> = {
  84532: { // Base Sepolia
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e": { symbol: "USDC", decimals: 6 },
    "0x4200000000000000000000000000000000000006": { symbol: "WETH", decimals: 18 },
    "0xE4aB69C077896252FAFBD49EFD26B5D171A32410": { symbol: "LINK", decimals: 18 },
  },
  11155111: { // Ethereum Sepolia
    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238": { symbol: "USDC", decimals: 6 },
    "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": { symbol: "WETH", decimals: 18 },
  },
  421614: { // Arbitrum Sepolia
    "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d": { symbol: "USDC", decimals: 6 },
    "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73": { symbol: "WETH", decimals: 18 },
  },
};

const cache = new Map<string, TokenMeta>();

// `client` is Ponder's context.client (a viem PublicClient).
export async function resolveTokenMeta(
  chainId: number,
  tokenAddress: string,
  client: { readContract: (args: any) => Promise<any> },
): Promise<TokenMeta> {
  const key = `${chainId}:${tokenAddress.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const checksum = getAddress(tokenAddress) as Address;
  const known = KNOWN[chainId]?.[checksum];
  if (known) { cache.set(key, known); return known; }

  // Fallback: read symbol()/decimals() on-chain. Default to a safe value on failure.
  let symbol = "TOKEN";
  let decimals = 18;
  try {
    decimals = Number(await client.readContract({ abi: erc20Abi, address: checksum, functionName: "decimals" }));
  } catch { /* keep default */ }
  try {
    symbol = String(await client.readContract({ abi: erc20Abi, address: checksum, functionName: "symbol" }));
  } catch { /* keep default */ }

  const meta = { symbol, decimals };
  cache.set(key, meta);
  return meta;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/backend/indexer`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/indexer/src/lib/tokenMeta.ts
git commit -m "feat(indexer): token metadata resolver (registry + on-chain fallback)"
```

---

## Task 4: Supabase projection helper (idempotent incoming-transfer upsert)

**Files:**
- Create: `apps/backend/indexer/src/lib/projectTransfer.ts`

Fixes the integer-division `amountDisplay` bug (use `formatUnits`) and writes a schema-correct row. Note: incoming transfers use `type: 'send_erc20' | 'send_native'` + `direction: 'incoming'` — there is **no** `receive_*` type in the DB `CHECK` constraint (verified in `20260503020000_expand_wallet_transactions_lifecycle.sql`). Display is handled in Task 8.

- [ ] **Step 1: Implement the helper**

`apps/backend/indexer/src/lib/projectTransfer.ts`:
```typescript
import { formatUnits } from "viem";
import { supabase } from "./supabase.js";
import { networkKeyForChain } from "./networkKeys.js";

export interface IncomingTransfer {
  chainId: number;
  txHash: string;
  logIndex: number;        // -1 for native
  from: string;
  to: string;              // the receiving smart account
  tokenType: "native" | "erc20";
  tokenAddress: string | null;
  tokenSymbol: string;
  tokenDecimals: number;
  valueRaw: bigint;
  blockNumber: bigint;
  blockTimestampSec: bigint;
}

export async function projectIncomingTransfer(t: IncomingTransfer): Promise<void> {
  const networkKey = networkKeyForChain(t.chainId);
  if (!networkKey) return; // unknown chain — ignore

  // Resolve the receiving wallet → user_id. Only project transfers to known wallets.
  const { data: wallet } = await supabase
    .from("aa_wallets")
    .select("id, user_id, predicted_address")
    .eq("network_key", networkKey)
    .ilike("predicted_address", t.to)
    .maybeSingle();
  if (!wallet) return;

  const amountDisplay = formatUnits(t.valueRaw, t.tokenDecimals);

  const { error } = await supabase
    .from("wallet_transactions")
    .upsert(
      {
        user_id: wallet.user_id,
        aa_wallet_id: wallet.id,
        wallet_address: wallet.predicted_address,
        chain_id: t.chainId,
        network_key: networkKey,
        type: t.tokenType === "native" ? "send_native" : "send_erc20",
        status: "confirmed",
        direction: "incoming",
        token_type: t.tokenType,
        token_address: t.tokenAddress,
        token_symbol: t.tokenSymbol,
        token_decimals: t.tokenDecimals,
        from_address: t.from,
        to_address: t.to,
        amount_raw: t.valueRaw.toString(),
        amount_display: amountDisplay,
        target_address: t.to,
        value_raw: t.tokenType === "native" ? t.valueRaw.toString() : "0",
        calldata: "0x",
        transaction_hash: t.txHash,
        log_index: t.logIndex,
        block_number: Number(t.blockNumber),
        confirmed_at: new Date(Number(t.blockTimestampSec) * 1000).toISOString(),
        metadata: { source: "indexer" },
      },
      { onConflict: "chain_id,transaction_hash,log_index", ignoreDuplicates: true },
    );

  if (error && error.code !== "23505") {
    console.error("[indexer] projectIncomingTransfer failed", { txHash: t.txHash, error });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/backend/indexer`
Expected: PASS.

- [ ] **Step 3: Sanity-check `formatUnits` math (runnable assertion)**

Create a throwaway `apps/backend/indexer/scripts/_check.ts`:
```typescript
import { formatUnits } from "viem";
// 20 USDC (6 decimals) must display "20", NOT "0" (the old BigInt-division bug).
if (formatUnits(20_000000n, 6) !== "20") throw new Error("usdc fail");
if (formatUnits(1_500000n, 6) !== "1.5") throw new Error("frac fail");
console.log("ok");
```
Run: `npx tsx apps/backend/indexer/scripts/_check.ts`
Expected: prints `ok`. Then delete the file: `rm apps/backend/indexer/scripts/_check.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/indexer/src/lib/projectTransfer.ts
git commit -m "feat(indexer): idempotent incoming-transfer projection to Supabase"
```

---

## Task 5: Add all testnet chains to `ponder.config.ts` (env-gated, multi-chain)

**Files:**
- Modify: `apps/backend/indexer/src/addresses.ts`
- Modify: `apps/backend/indexer/ponder.config.ts`

- [ ] **Step 1: Add per-chain, env-driven definitions** in `apps/backend/indexer/src/addresses.ts`. A chain is only "active" when its RPC + AccountFactory env vars are set — so Arbitrum Sepolia stays dormant until deployed:

```typescript
export interface TestnetChainDef {
  id: number;
  rpc?: string;
  accountFactory?: `0x${string}`;
  socialRecovery?: `0x${string}`;
  passkeyValidator?: `0x${string}`;
  startBlock: number;
  tokens: `0x${string}`[]; // known ERC-20 contracts to index (Transfer-volume control)
}

export const TESTNET_CHAINS: Record<string, TestnetChainDef> = {
  baseSepolia: {
    id: 84532,
    rpc: process.env.PONDER_BASE_SEPOLIA_RPC_URL,
    accountFactory: process.env.BASE_SEPOLIA_ACCOUNT_FACTORY as `0x${string}` | undefined,
    socialRecovery: process.env.BASE_SEPOLIA_SOCIAL_RECOVERY as `0x${string}` | undefined,
    passkeyValidator: process.env.BASE_SEPOLIA_PASSKEY_VALIDATOR as `0x${string}` | undefined,
    startBlock: Number(process.env.BASE_SEPOLIA_START_BLOCK ?? "0"),
    tokens: [
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
      "0x4200000000000000000000000000000000000006", // WETH
      "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // LINK
    ],
  },
  ethSepolia: {
    id: 11155111,
    rpc: process.env.PONDER_ETH_SEPOLIA_RPC_URL,
    accountFactory: process.env.ETH_SEPOLIA_ACCOUNT_FACTORY as `0x${string}` | undefined,
    socialRecovery: process.env.ETH_SEPOLIA_SOCIAL_RECOVERY as `0x${string}` | undefined,
    passkeyValidator: process.env.ETH_SEPOLIA_PASSKEY_VALIDATOR as `0x${string}` | undefined,
    startBlock: Number(process.env.ETH_SEPOLIA_START_BLOCK ?? "0"),
    tokens: [
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
      "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", // WETH
    ],
  },
  arbSepolia: { // not deployed yet — omitted automatically until env vars are set
    id: 421614,
    rpc: process.env.PONDER_ARB_SEPOLIA_RPC_URL,
    accountFactory: process.env.ARB_SEPOLIA_ACCOUNT_FACTORY as `0x${string}` | undefined,
    socialRecovery: process.env.ARB_SEPOLIA_SOCIAL_RECOVERY as `0x${string}` | undefined,
    passkeyValidator: process.env.ARB_SEPOLIA_PASSKEY_VALIDATOR as `0x${string}` | undefined,
    startBlock: Number(process.env.ARB_SEPOLIA_START_BLOCK ?? "0"),
    tokens: [
      "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC
      "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
    ],
  },
};

// Active = RPC and AccountFactory both configured. Arb Sepolia disappears until deployed.
export const ACTIVE_TESTNET_CHAINS: Record<string, Required<Pick<TestnetChainDef, "id" | "rpc" | "accountFactory">> & TestnetChainDef> =
  Object.fromEntries(
    Object.entries(TESTNET_CHAINS).filter(([, c]) => Boolean(c.rpc && c.accountFactory)),
  ) as any;
```

- [ ] **Step 2: Build the config programmatically from active chains** in `ponder.config.ts`. This adds every active testnet alongside `anvilLocal`, restricts `Erc20Inbound` to the known token contracts per chain (volume control), and wires the `accounts` factory per chain for native receives:

```typescript
import { createConfig, factory } from "ponder";
import { http, parseAbiItem } from "viem";
import { AccountFactoryAbi } from "./abis/AccountFactory.abi.js";
import { SmartAccountAbi } from "./abis/SmartAccount.abi.js";
import { SocialRecoveryAbi } from "./abis/SocialRecovery.abi.js";
import { PasskeyValidatorAbi } from "./abis/PasskeyValidator.abi.js";
import { EntryPointAbi } from "./abis/EntryPoint.abi.js";
import { Erc20Abi } from "./abis/Erc20.abi.js";
import { ANVIL_LOCAL, ENTRYPOINT_V07 } from "./src/addresses.js";
import { ACTIVE_TESTNET_CHAINS } from "./src/addresses.js";

const ACCOUNT_CREATED = parseAbiItem(
  "event AccountCreated(address indexed account, bytes32 indexed walletId, uint256 indexed walletIndex, bytes32 mode, bytes32 salt)",
);

// chains map: always anvilLocal + each active testnet.
const chains: Record<string, any> = {
  anvilLocal: {
    id: 31337,
    transport: http(process.env.PONDER_ANVIL_RPC_URL ?? "http://192.168.100.68:8545"),
    pollingInterval: 1000,
  },
};
for (const [key, c] of Object.entries(ACTIVE_TESTNET_CHAINS)) {
  chains[key] = { id: c.id, transport: http(c.rpc), pollingInterval: 2000 };
}

// Spread a per-chain entry for each active testnet for a given contract field.
const perChain = (build: (c: (typeof ACTIVE_TESTNET_CHAINS)[string]) => any) =>
  Object.fromEntries(Object.entries(ACTIVE_TESTNET_CHAINS).map(([key, c]) => [key, build(c)]));

export default createConfig({
  database: { kind: "postgres", connectionString: process.env.DATABASE_URL! },
  chains,
  contracts: {
    AccountFactory: {
      abi: AccountFactoryAbi,
      chain: {
        anvilLocal: { address: ANVIL_LOCAL.accountFactory as `0x${string}`, startBlock: 0 },
        ...perChain((c) => ({ address: c.accountFactory, startBlock: c.startBlock })),
      },
    },
    SmartAccount: {
      abi: SmartAccountAbi,
      chain: {
        anvilLocal: {
          address: factory({ address: ANVIL_LOCAL.accountFactory as `0x${string}`, event: ACCOUNT_CREATED, parameter: "account" }),
          startBlock: 0,
        },
        ...perChain((c) => ({
          address: factory({ address: c.accountFactory, event: ACCOUNT_CREATED, parameter: "account" }),
          startBlock: c.startBlock,
        })),
      },
    },
    SocialRecovery: {
      abi: SocialRecoveryAbi,
      chain: {
        anvilLocal: { address: ANVIL_LOCAL.socialRecovery as `0x${string}`, startBlock: 0 },
        ...perChain((c) => ({ address: c.socialRecovery, startBlock: c.startBlock })),
      },
    },
    PasskeyValidator: {
      abi: PasskeyValidatorAbi,
      chain: {
        anvilLocal: { address: ANVIL_LOCAL.passkeyValidator as `0x${string}`, startBlock: 0 },
        ...perChain((c) => ({ address: c.passkeyValidator, startBlock: c.startBlock })),
      },
    },
    EntryPoint: {
      abi: EntryPointAbi,
      chain: {
        anvilLocal: { address: ENTRYPOINT_V07, startBlock: 0 },
        ...perChain((c) => ({ address: ENTRYPOINT_V07, startBlock: c.startBlock })),
      },
    },
    // ERC-20 receives: restrict to KNOWN TOKEN CONTRACTS per chain (volume control).
    // anvilLocal stays unfiltered (low local volume).
    Erc20Inbound: {
      abi: Erc20Abi,
      chain: {
        anvilLocal: { startBlock: 0 },
        ...perChain((c) => ({ address: c.tokens, startBlock: c.startBlock })),
      },
    },
  },
  accounts: {
    KnownAccounts: {
      chain: {
        anvilLocal: {
          address: factory({ address: ANVIL_LOCAL.accountFactory as `0x${string}`, event: ACCOUNT_CREATED, parameter: "account" }),
          startBlock: 0,
        },
        ...perChain((c) => ({
          address: factory({ address: c.accountFactory, event: ACCOUNT_CREATED, parameter: "account" }),
          startBlock: c.startBlock,
        })),
      },
    },
  },
  blocks: {
    HealthBeat: { chain: "anvilLocal", interval: 100, startBlock: 0 },
  },
});
```

> **Volume-control note:** `Erc20Inbound.address: c.tokens` limits indexing to your registry tokens, so we don't backfill every Transfer on three live testnets. To also catch *arbitrary* tokens sent to your accounts, test `filter: { event: "Transfer", args: { to: factory({...}) } }` during implementation — if Ponder 0.11.44 accepts a `factory()` args-filter value, switch to it (drop the token list). It was not confirmed in the grilled docs.

- [ ] **Step 3: Codegen + typecheck**

Run: `pnpm --filter trezo-indexer codegen && npx tsc --noEmit -p apps/backend/indexer`
Expected: PASS. `ponder-env.d.ts` regenerates with `KnownAccounts:*` plus per-chain event types for each active chain.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/indexer/src/addresses.ts apps/backend/indexer/ponder.config.ts apps/backend/indexer/ponder-env.d.ts
git commit -m "feat(indexer): multi-chain testnet indexing (base/eth/arb sepolia, env-gated) + token-filtered ERC-20"
```

> **startBlock note (per chain):** each `*_START_BLOCK` MUST be ≤ that chain's AccountFactory deploy block so the factory replay discovers every already-deployed wallet; otherwise pre-existing wallets are invisible to both the ERC-20 recipient filter and the `accounts` native handler.

---

## Task 6: ERC-20 inbound handler writes to Supabase

**Files:**
- Modify: `apps/backend/indexer/src/handlers/erc20Inbound.ts`

- [ ] **Step 1: Update the handler** to resolve metadata and project to Supabase (it still also records to `context.db` for reorg-safe replay):

```typescript
import { ponder } from "ponder:registry";
import { incomingErc20Transfer } from "ponder:schema";
import { isKnownAccount } from "../lib/knownAccounts.js";
import { resolveTokenMeta } from "../lib/tokenMeta.js";
import { projectIncomingTransfer } from "../lib/projectTransfer.js";

ponder.on("Erc20Inbound:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  const chainId = BigInt(context.network.chainId);

  if (!isKnownAccount(chainId, to)) return;

  await context.db
    .insert(incomingErc20Transfer)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      fromAddress: from,
      toAddress: to,
      tokenAddress: event.log.address,
      value,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: true,
    })
    .onConflictDoNothing();

  const meta = await resolveTokenMeta(Number(chainId), event.log.address, context.client);
  await projectIncomingTransfer({
    chainId: Number(chainId),
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    from,
    to,
    tokenType: "erc20",
    tokenAddress: event.log.address,
    tokenSymbol: meta.symbol,
    tokenDecimals: meta.decimals,
    valueRaw: value,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p apps/backend/indexer`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/indexer/src/handlers/erc20Inbound.ts
git commit -m "feat(indexer): write incoming ERC-20 to Supabase with real token metadata"
```

---

## Task 7: Native ETH inbound handler

**Files:**
- Rewrite: `apps/backend/indexer/src/handlers/nativeInbound.ts` (currently an empty Phase-9 placeholder)

- [ ] **Step 1: Implement the `transfer:to` handler.** Ponder fires `KnownAccounts:transfer:to` for native value transfers into a factory-discovered account.

```typescript
import { ponder } from "ponder:registry";
import { projectIncomingTransfer } from "../lib/projectTransfer.js";

// Fires for native ETH value transfers INTO a factory-discovered smart account.
ponder.on("KnownAccounts:transfer:to", async ({ event, context }) => {
  const value = event.transfer.value;
  if (value <= 0n) return;

  await projectIncomingTransfer({
    chainId: Number(context.network.chainId),
    txHash: event.transaction.hash,
    logIndex: -1, // native transfers have no log index
    from: event.transfer.from,
    to: event.transfer.to,
    tokenType: "native",
    tokenAddress: null,
    tokenSymbol: "ETH",
    tokenDecimals: 18,
    valueRaw: value,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});
```

> **Field-name check during implementation:** confirm the transfer event shape via the regenerated `ponder-env.d.ts` (`event.transfer.{from,to,value}` vs `event.args`). If `transfer:to` requires trace support the RPC lacks, fall back to `KnownAccounts:transaction:to` and read `event.transaction.{from,to,value,input}`, filtering `value > 0n && input === "0x"`. Alchemy Base Sepolia supports the trace methods `transfer:to` needs.

- [ ] **Step 2: Codegen + typecheck**

Run: `pnpm --filter trezo-indexer codegen && npx tsc --noEmit -p apps/backend/indexer`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/indexer/src/handlers/nativeInbound.ts
git commit -m "feat(indexer): native ETH inbound detection via accounts transfer:to"
```

---

## Task 8: Fix Recent Activity display for incoming transfers

**Files:**
- Modify: `apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx:27-45`

The amount sign is already direction-aware (`getAmount`, line 68). The label/icon are not — they say "Send Token" + up-arrow for incoming.

- [ ] **Step 1: Make `getTypeLabel` direction-aware** (replace lines 27-36):

```typescript
const getTypeLabel = (tx: WalletTransaction): string => {
  if (tx.direction === "incoming") {
    return tx.tokenType === "native" || tx.type === "send_native" ? "Received" : "Received";
  }
  switch (tx.type) {
    case "send_native":
      return "Send Native";
    case "send_erc20":
      return "Send Token";
    default:
      return tx.type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
};
```

- [ ] **Step 2: Make `getIcon` direction-aware** (replace lines 38-45):

```typescript
const getIcon = (tx: WalletTransaction): keyof typeof Feather.glyphMap => {
  if (tx.direction === "incoming") return "arrow-down-left";
  if (tx.type === "send_native" || tx.type === "send_erc20") return "arrow-up-right";
  if (tx.type === "swap" || tx.type === "cross_chain_swap") return "repeat";
  if (tx.type === "bridge") return "shuffle";
  if (tx.type === "module_install") return "tool";
  if (tx.type === "recovery") return "shield";
  return "activity";
};
```

- [ ] **Step 3: Verify**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx
git commit -m "fix(mobile): show incoming transfers as Received with down-arrow"
```

---

## Task 9 (Phase 2): Port security-event + UserOp streams to Supabase writes

**Files:**
- Modify: `apps/backend/indexer/src/handlers/socialRecovery.ts`, `smartAccount.ts`, `entryPoint.ts`

The existing `sync-worker` pollers (`accountSecurityEvents.ts`, `userOpConfirmations.ts`) do this projection from Ponder tables; port their Supabase logic into the corresponding handlers so the standalone worker can be retired. UserOp confirmation is an **UPDATE** of the mobile-authored `wallet_transactions` row matched by `user_op_hash` (do not fabricate rows when none exists).

- [ ] **Step 1:** In `entryPoint.ts`, after the `context.db.insert`, look up `wallet_transactions` by `user_op_hash`; if found and status not terminal, update `status` (`confirmed`/`failed`), `transaction_hash`, `block_number`, `confirmed_at` — mirroring `userOpConfirmations.ts` lines 50-62.
- [ ] **Step 2:** In `socialRecovery.ts`/`smartAccount.ts`, after each `context.db.insert`, call a new `projectSecurityEvent(...)` helper (mirror `accountSecurityEvents.ts`) that inserts into the Supabase notifications source the app expects.
- [ ] **Step 3:** Typecheck: `npx tsc --noEmit -p apps/backend/indexer` → PASS.
- [ ] **Step 4:** Commit: `git commit -m "feat(indexer): port security + userop streams to direct Supabase writes"`

---

## Task 10 (Phase 2): Retire the standalone sync-worker

- [ ] **Step 1:** Delete `apps/backend/indexer/sync-worker/` and the `worker:sync` script from `apps/backend/indexer/package.json` once Tasks 6, 7, 9 are verified in production.
- [ ] **Step 2:** Commit: `git commit -m "chore(indexer): retire sync-worker (handlers now write Supabase directly)"`

> Defer this until after the Render deploy is confirmed working. Keeping the worker temporarily is a safe rollback.

---

## Task 11: Deploy to Render free + Neon

**Files:**
- Create: `apps/backend/indexer/render.yaml`
- Modify: `apps/backend/indexer/.env.example`

- [ ] **Step 1: render.yaml**

```yaml
services:
  - type: web
    name: trezo-indexer
    runtime: node
    plan: free
    rootDir: apps/backend/indexer
    buildCommand: pnpm install --frozen-lockfile && pnpm codegen
    startCommand: pnpm start -- --hostname 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL          # Neon pooled, ?sslmode=require
        sync: false
      - key: PONDER_DATABASE_SCHEMA
        value: indexer_v1
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      # --- Base Sepolia (active) ---
      - key: PONDER_BASE_SEPOLIA_RPC_URL   # Alchemy
        sync: false
      - key: BASE_SEPOLIA_ACCOUNT_FACTORY
        sync: false
      - key: BASE_SEPOLIA_SOCIAL_RECOVERY
        sync: false
      - key: BASE_SEPOLIA_PASSKEY_VALIDATOR
        sync: false
      - key: BASE_SEPOLIA_START_BLOCK
        sync: false
      # --- Ethereum Sepolia (active) ---
      - key: PONDER_ETH_SEPOLIA_RPC_URL
        sync: false
      - key: ETH_SEPOLIA_ACCOUNT_FACTORY
        sync: false
      - key: ETH_SEPOLIA_SOCIAL_RECOVERY
        sync: false
      - key: ETH_SEPOLIA_PASSKEY_VALIDATOR
        sync: false
      - key: ETH_SEPOLIA_START_BLOCK
        sync: false
      # --- Arbitrum Sepolia (leave UNSET until deployed; chain auto-omitted) ---
      # - key: PONDER_ARB_SEPOLIA_RPC_URL
      # - key: ARB_SEPOLIA_ACCOUNT_FACTORY
      # - key: ARB_SEPOLIA_SOCIAL_RECOVERY
      # - key: ARB_SEPOLIA_PASSKEY_VALIDATOR
      # - key: ARB_SEPOLIA_START_BLOCK
      - key: NODE_OPTIONS
        value: "--max-old-space-size=450"
```

- [ ] **Step 2:** Update `.env.example` to document every env var above. Commit:
```bash
git add apps/backend/indexer/render.yaml apps/backend/indexer/.env.example
git commit -m "feat(indexer): Render free + Neon deploy config"
```

- [ ] **Step 3: Create the Render service** (dashboard or `render.yaml` blueprint), set all `sync:false` secrets, deploy.
- [ ] **Step 4: Verify deploy** — once live:
  - `curl https://<service>.onrender.com/health` → 200.
  - `curl https://<service>.onrender.com/status` → JSON; wait until `baseSepolia.ready === true` (historical backfill complete).
- [ ] **Step 5: Keep-awake pinger** — create a free cron-job.org (or UptimeRobot) monitor GET `https://<service>.onrender.com/health` every 10 minutes. Confirms the service does not spin down (one always-on service ≈ 730h, within Render's 750h/month).

---

## Task 12: End-to-end verification

- [ ] **Step 1:** On a device running the app on **Base Sepolia**, with a deployed smart account, send **test USDC** to the wallet from a faucet/another address.
- [ ] **Step 2:** Within ~1 block + poll interval, confirm: a row appears in **Recent Activity** as "Received USDC +X.XX" with a down-arrow; an **in-app notification** appears; (after Plan 2/FCM) an **OS push** arrives.
- [ ] **Step 3:** Send **native ETH** to the wallet; confirm "Received ETH +X.XX" appears.
- [ ] **Step 4:** Confirm USDC shows the **correct decimals/amount** (not "0", not 18-decimal garbage) and symbol "USDC" (not "ERC20").

---

## Self-Review

- **Spec coverage:** receives in activity (Tasks 4,6,7,8), in-app notification (existing Supabase trigger fires on the `wallet_transactions` insert from Task 4), Base Sepolia (Task 5), $0 Render+Neon (Task 11), native ETH (Task 7), ERC-20 metadata/amount bugs (Tasks 3,6), sync-worker elimination (Tasks 6,7,9,10). ✔
- **Push delivery** depends on Plan 2 (FCM) for a valid device token — noted in Task 12 step 2.
- **Type consistency:** `IncomingTransfer` fields used identically in Tasks 4/6/7; `type` values restricted to the DB `CHECK` set; `onConflict` matches the unique index from Task 1.
- **Open value to confirm at implementation:** the exact native-transfer event field names (`event.transfer.*`), and `FACTORY_START_BLOCK` from the deployment manifest (Task 0 Step 3).
