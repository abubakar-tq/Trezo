# Chrome Extension — Multi-Chain Revision

> Supersedes the single-chain parts of `2026-05-31-chrome-extension-dapp-connector-plan.md` (Milestone 2 `config.ts`, and the chain-awareness of M4–M6). Everything else in that plan still applies.

**Why:** The extension is a multi-chain **Linked Device**. One user, **per-chain account** (possibly a *different address per chain* — passkey rotation breaks portability). The **chain picker is the wallet picker**. The extension's single passkey is registered **per-chain**; linked on one chain ≠ linked on another. Chains: **Sepolia (11155111), Base Sepolia (84532), Arbitrum Sepolia (421614)** — public testnets only (no Anvil/forks). See CONTEXT.md "Device pairing" + "Per-chain address divergence".

---

## R1 — Multi-chain network registry (replaces single-chain `core/config.ts`)

**Files:**
- Copy per-chain deployment JSONs from mobile into `apps/extension/src/core/deployments/`:
  - `apps/mobile/src/integration/contracts/deployment.sepolia.json` → `core/deployments/sepolia.json`
  - `apps/mobile/src/integration/contracts/deployment.base-sepolia.json` → `core/deployments/base-sepolia.json`
  - `apps/mobile/src/integration/contracts/deployment.arb-sepolia.json` → `core/deployments/arb-sepolia.json` (if it exists; if not, omit that chain)
- Delete the old `core/deployments.json`.
- Create `core/networks.ts`.
- Update `core/config.ts` to hold ONLY shared config.
- Update `core/clients.ts` and `core/userOps.ts` to be chain-keyed.

**`core/networks.ts`** — tolerant registry (a chain is "enabled" only if its RPC + bundler env are present, so a missing chain never breaks load):

```ts
import sepoliaDep from "./deployments/sepolia.json";
import baseSepoliaDep from "./deployments/base-sepolia.json";
import arbSepoliaDep from "./deployments/arb-sepolia.json";

export type ExtChainId = 11155111 | 84532 | 421614;

export type NetworkConfig = {
  chainId: ExtChainId;
  name: string;
  rpcUrl: string;
  bundlerUrl: string;
  paymasterUrl: string;
  blockExplorerUrl: string;
  deployment: typeof sepoliaDep;
};

const env = import.meta.env;

const RAW: Array<{ chainId: ExtChainId; name: string; explorer: string; dep: typeof sepoliaDep;
  rpc?: string; bundler?: string; paymaster?: string }> = [
  { chainId: 11155111, name: "Ethereum Sepolia", explorer: "https://sepolia.etherscan.io", dep: sepoliaDep,
    rpc: env.VITE_SEPOLIA_RPC_URL, bundler: env.VITE_SEPOLIA_BUNDLER_URL, paymaster: env.VITE_SEPOLIA_PAYMASTER_URL },
  { chainId: 84532, name: "Base Sepolia", explorer: "https://sepolia.basescan.org", dep: baseSepoliaDep,
    rpc: env.VITE_BASE_SEPOLIA_RPC_URL, bundler: env.VITE_BASE_SEPOLIA_BUNDLER_URL, paymaster: env.VITE_BASE_SEPOLIA_PAYMASTER_URL },
  { chainId: 421614, name: "Arbitrum Sepolia", explorer: "https://sepolia.arbiscan.io", dep: arbSepoliaDep,
    rpc: env.VITE_ARB_SEPOLIA_RPC_URL, bundler: env.VITE_ARB_SEPOLIA_BUNDLER_URL, paymaster: env.VITE_ARB_SEPOLIA_PAYMASTER_URL },
];

export const NETWORKS: Partial<Record<ExtChainId, NetworkConfig>> = {};
for (const r of RAW) {
  if (r.rpc && r.bundler) {
    NETWORKS[r.chainId] = {
      chainId: r.chainId, name: r.name, rpcUrl: r.rpc, bundlerUrl: r.bundler,
      paymasterUrl: r.paymaster ?? r.bundler, blockExplorerUrl: r.explorer, deployment: r.dep,
    };
  }
}

export const ENABLED_CHAIN_IDS = Object.keys(NETWORKS).map(Number) as ExtChainId[];
export const DEFAULT_CHAIN_ID: ExtChainId = (ENABLED_CHAIN_IDS.includes(11155111) ? 11155111 : ENABLED_CHAIN_IDS[0]);

export const getNetwork = (chainId: number): NetworkConfig => {
  const n = NETWORKS[chainId as ExtChainId];
  if (!n) throw new Error(`Unsupported/!enabled chain ${chainId}`);
  return n;
};
export const isEnabledChain = (chainId: number): boolean => chainId in NETWORKS;
```

**`core/config.ts`** — shared only:

```ts
function req(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing required env ${name}. Set it in apps/extension/.env.local`);
  return v;
}
export const SHARED_CONFIG = {
  rpId: import.meta.env.VITE_PASSKEY_RP_ID || "abubakar-tq.github.io",
  supabaseUrl: req("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: req("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY),
};
```

**`core/clients.ts`** — chain-keyed viem clients (build + cache per chain):

```ts
import { createPublicClient, defineChain, http, type Chain } from "viem";
import { getNetwork, type ExtChainId } from "./networks";

const chainCache = new Map<number, Chain>();
export const getViemChain = (chainId: number): Chain => {
  if (chainCache.has(chainId)) return chainCache.get(chainId)!;
  const n = getNetwork(chainId);
  const c = defineChain({
    id: n.chainId, name: n.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [n.rpcUrl] }, public: { http: [n.rpcUrl] } },
    testnet: true,
  });
  chainCache.set(chainId, c);
  return c;
};
export const getPublicClient = (chainId: number) =>
  createPublicClient({ chain: getViemChain(chainId), transport: http(getNetwork(chainId).rpcUrl, { timeout: 60_000 }) });
```

**`core/userOps.ts`** — change the local `getDeployment` to be chain-keyed:
```ts
import { getNetwork } from "./networks";
const getDeployment = (chainId: number) => getNetwork(chainId).deployment;
```
(Remove the old `import deployment from "./deployments.json"` line. Everything else stays — every `userOps` function already takes `chainId` + `bundlerUrl`/`paymasterUrl` explicitly.)

**`.env.example`** (commit) and **`.env.local`** (gitignored) — per-chain keys for all three, copied from `apps/mobile/.env`:
```
VITE_SEPOLIA_RPC_URL=...            (EXPO_PUBLIC_SEPOLIA_RPC_URL)
VITE_SEPOLIA_BUNDLER_URL=...        (EXPO_PUBLIC_SEPOLIA_BUNDLER_URL)
VITE_SEPOLIA_PAYMASTER_URL=...      (EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL)
VITE_BASE_SEPOLIA_RPC_URL=...       (EXPO_PUBLIC_BASE_SEPOLIA_RPC_URL)
VITE_BASE_SEPOLIA_BUNDLER_URL=...   (EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL)
VITE_BASE_SEPOLIA_PAYMASTER_URL=... (EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL)
VITE_ARB_SEPOLIA_RPC_URL=...        (EXPO_PUBLIC_ARB_SEPOLIA_RPC_URL — if present)
VITE_ARB_SEPOLIA_BUNDLER_URL=...    (EXPO_PUBLIC_ARB_SEPOLIA_BUNDLER_URL — if present)
VITE_ARB_SEPOLIA_PAYMASTER_URL=...  (EXPO_PUBLIC_ARB_SEPOLIA_PAYMASTER_URL — if present)
VITE_PASSKEY_RP_ID=abubakar-tq.github.io
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
If a chain's env is absent in mobile `.env`, leave those keys out — that chain is auto-disabled.

**Fix all references** to the old single-chain `EXTENSION_CONFIG`: grep `EXTENSION_CONFIG` and replace each usage with `getNetwork(chainId)` (for chain-specific values) or `SHARED_CONFIG` (rpId/supabase). Affected so far: `chains.ts` (delete — replaced by `clients.ts` getViemChain), `passkey/webauthnService.ts` (uses `EXTENSION_CONFIG.rpId` → `SHARED_CONFIG.rpId`), `auth/supabaseClient.ts` (→ `SHARED_CONFIG`), `pairing/walletResolver.ts`, `rpc/rpcRouter.ts`, `core/smartAccountExecution.ts` (when built).

**Verify:** `npm run -w apps/extension build` + `npm run -w apps/extension test` pass.

## R2 — Active chain state

**`core/activeChain.ts`:**
```ts
import { DEFAULT_CHAIN_ID, ENABLED_CHAIN_IDS, type ExtChainId } from "./networks";
const KEY = "trezo_active_chain_v1";
export async function getActiveChainId(): Promise<ExtChainId> {
  const out = await chrome.storage.local.get(KEY);
  const c = out[KEY] as ExtChainId | undefined;
  return c && ENABLED_CHAIN_IDS.includes(c) ? c : DEFAULT_CHAIN_ID;
}
export async function setActiveChainId(chainId: ExtChainId): Promise<void> {
  await chrome.storage.local.set({ [KEY]: chainId });
}
```

## R3 — Per-chain wallet resolver (replaces single `pairing/walletResolver.ts`)

Query `aa_wallets` per chain. Confirm column names against mobile `SupabaseWalletService` (`predicted_address`, `chain_id`, `is_deployed`, `network_key`).

```ts
import { supabase } from "../auth/supabaseClient";
export type ChainWallet = { address: `0x${string}`; chainId: number; isDeployed: boolean };

export const WalletResolver = {
  async getForChain(userId: string, chainId: number): Promise<ChainWallet | null> {
    const { data } = await supabase.from("aa_wallets")
      .select("predicted_address, chain_id, is_deployed")
      .eq("user_id", userId).eq("chain_id", chainId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!data?.predicted_address) return null;
    return { address: data.predicted_address as `0x${string}`, chainId, isDeployed: Boolean(data.is_deployed) };
  },
  async listChains(userId: string): Promise<number[]> {
    const { data } = await supabase.from("aa_wallets")
      .select("chain_id, is_deployed").eq("user_id", userId);
    return (data ?? []).filter((r: any) => r.is_deployed).map((r: any) => r.chain_id as number);
  },
};
```
(Drop the old `chrome.storage`-cached single wallet — the per-chain Supabase read is the source of truth. Cache the *active* selection only via `activeChain.ts`.)

## R4 — Per-chain device-link status

**`pairing/deviceLink.ts`** — port `getRegisteredCredentialIds` from mobile `PasskeyService` (reads `passkeyValidator.passkeyCount` / `passkeyAt`), then check if THIS extension's credential is among them.

```ts
import { getPublicClient } from "../core/clients";
import { getNetwork } from "../core/networks";
import { ABIS } from "../core/abis";

// returns true if credentialIdRaw (bytes32) is registered in this chain's account
export async function isDeviceLinkedOnChain(
  chainId: number, account: `0x${string}`, credentialIdRaw: `0x${string}`,
): Promise<boolean> {
  const validator = getNetwork(chainId).deployment.passkeyValidator as `0x${string}` | undefined;
  if (!validator) return false;
  const client = getPublicClient(chainId);
  let count: bigint;
  try {
    count = (await client.readContract({ address: validator, abi: ABIS.passkeyValidator,
      functionName: "passkeyCount", args: [account] })) as bigint;
  } catch { return false; }
  for (let i = 0n; i < count; i++) {
    const raw = (await client.readContract({ address: validator, abi: ABIS.passkeyValidator,
      functionName: "passkeyAt", args: [account, i] })) as string;
    if (raw.toLowerCase() === credentialIdRaw.toLowerCase()) return true;
  }
  return false;
}
```
(Confirm `passkeyValidator` ABI has `passkeyCount(address)` and `passkeyAt(address,uint256)` — it does per mobile `PasskeyService.getRegisteredCredentialIds`. The stored bytes32 may be right-zero-padded; compare normalized.)

## R5 — Reuse the passkey across chains

Add to `passkey/webauthnService.ts`:
```ts
  async getOrCreate(userId: string): Promise<PasskeyMetadata> {
    const existing = await this.getStored();
    if (existing) return existing;
    return this.create(userId);
  },
```
`PairDeviceScreen` must call `WebAuthnService.getOrCreate(user.id)` (NOT `create`) so re-linking on another chain registers the SAME credential.

## R6 — Chain switcher + per-chain Home + pairing reuse (revises M4 popup)

**`popup/components/ChainSwitcher.tsx`** — a small dropdown listing `ENABLED_CHAIN_IDS` by `getNetwork(id).name`, showing the active chain, calling `setActiveChainId(id)` + an `onChange` refresh on select. Style to match the dark popup.

**`HomeScreen.tsx`** (revised) — on mount and on chain change:
1. `chainId = await getActiveChainId()`.
2. `wallet = await WalletResolver.getForChain(user.id, chainId)`.
3. Render the `<ChainSwitcher>` at top.
4. If `!wallet` → show "No account on {name} yet — set it up in the Trezo app."
5. If `wallet && !wallet.isDeployed` → "Not active on {name}."
6. If `wallet` deployed → show `wallet.address`, then check `meta = WebAuthnService.getStored()`; if `meta` and `await isDeviceLinkedOnChain(chainId, wallet.address, meta.credentialIdRaw)` is false → show a **"Link this device on {name}"** button whose handler routes to the pair screen with a hint: *"On your phone, switch to {name}, then Profile → Devices → Pair New Device, and paste the code here."* If linked → show a "Linked ✓" badge.

**`PairDeviceScreen.tsx`** (revised) — use `WebAuthnService.getOrCreate`. After `pollUntilApproved`, save nothing chain-global; instead set `await setActiveChainId(approved.chain_id)` and let Home re-read per-chain. The pairing request's `chain_id` (set by the phone) is the chain being linked. Show the chain name from `approved.chain_id` in the success copy.

**`App.tsx`** routing: after login, go to **Home** (not a forced pair screen) — Home now handles per-chain "link" prompts itself. Keep a route to PairDeviceScreen reachable from the "Link this device" button and a manual "Pair" affordance.

## M5/M6 become chain-aware (when built)

When implementing Milestone 5 (connect/sign) and Milestone 6 (gasless tx), build them chain-aware from the start:
- `rpc/rpcRouter.ts`: resolve the chain per request as `session?.chainId ?? await getActiveChainId()`. `eth_chainId` returns it. `eth_requestAccounts` returns `WalletResolver.getForChain(user, chainId).address`. `wallet_switchEthereumChain` → if `isEnabledChain(target)` then `setActiveChainId(target)` + update the origin session + emit `chainChanged`; else `4902`.
- Before `personal_sign`/`eth_signTypedData_v4`/`eth_sendTransaction`, check `isDeviceLinkedOnChain(chainId, account, meta.credentialIdRaw)`. If not linked → reject with a clear error (code 4100, message "This device isn't linked on {name}. Open Trezo to link it.") so the dApp surfaces it; the popup Home shows the link CTA.
- `core/smartAccountExecution.ts` + the sign sheets: take `chainId` and use `getNetwork(chainId).bundlerUrl/paymasterUrl` and `getPublicClient(chainId)` — never a hard-coded chain.

## Sequencing for implementation
1. **R1 + R2** (multi-chain core) — one Sonnet agent; verify build + test.
2. **R3 + R4 + R5** (per-chain wallet/link/getOrCreate) — one Sonnet agent; verify build.
3. **R6** (chain switcher + per-chain Home + PairDeviceScreen) — one Sonnet agent; verify build; **user runtime-tests pairing on their deployed chain**.
4. **M5 then M6**, chain-aware per above — Sonnet agents; user runtime-tests connect/sign/tx.
