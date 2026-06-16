# Stablecoin Peg + Price-Source Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.
>
> **Testing note:** The mobile app has **no jest runner** (scripts: `start`/`android`/`ios`/`web`/`lint`). Verification uses `npx tsc --noEmit`, `npx expo lint`, a runnable `npx tsx` assertion for pure logic, and on-device checks — per the repo's established pattern.

**Goal:** (a) Stop the USD balance jitter ($19.99↔$20.01) for stablecoins by pegging tagged stablecoins to $1.00 (conditionally), and (b) replace the dead CoinCap primary (its DNS no longer resolves, so the fallback log fires every cycle) with CoinGecko, keeping Binance as fallback.

**Architecture:** Two independent changes. (1) In `CoinCapPriceProvider.getPricesUsd` (the source of the *balance* valuation), peg registry-tagged stablecoins to `1.00` when the live price is within ±2% (so a genuine depeg still shows). (2) In `MarketService`, make **CoinGecko Demo API** the primary source (`/coins/markets`), keep the existing Binance fallback. Add required CoinGecko attribution.

**Tech Stack:** CoinGecko Demo API (`api.coingecko.com`, header `x-cg-demo-api-key`, free key: 100 calls/min, 10k/month), Binance public ticker (fallback), existing `tokenRegistry` tags.

**Verified facts:** `api.coincap.io` no longer resolves (DNS-dead; v2 deprecated ~2025-04, v3 needs a key) — the "[MarketService] CoinCap Network/DNS failure" log is permanent. Every market feed (incl. CoinGecko) returns USDC ~0.999–1.001, so the jitter is fixed by a **display peg**, not a feed swap. Binance already pegs USDC/USDT to 1.00 in `getTicker24h`/`getKlines` but NOT in `getGlobalMarketStats` (the path feeding the balance) — hence the wobble.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/mobile/src/features/assets/config/tokenRegistry.ts` | Add `isStablecoinAddress(chainId, address)` helper | Modify |
| `apps/mobile/src/features/portfolio/services/PriceProvider.ts` | Conditional stablecoin peg in `getPricesUsd` | Modify |
| `apps/mobile/src/services/MarketService.ts` | CoinGecko primary in `getTopAssets`; CoinGecko attribution | Modify |
| `apps/mobile/.env.example` | Document `EXPO_PUBLIC_COINGECKO_API_KEY` | Modify |
| A visible UI surface (markets screen footer) | "Data provided by CoinGecko" attribution (required by free tier) | Modify |

---

## Task 1: Stablecoin lookup helper

**Files:**
- Modify: `apps/mobile/src/features/assets/config/tokenRegistry.ts` (append after `BUILTIN_TOKENS_BY_NETWORK`)

- [ ] **Step 1: Add the helper**

```typescript
const STABLECOIN_ADDRESSES: Set<string> = new Set(
  Object.values(BUILTIN_TOKENS_BY_NETWORK)
    .flat()
    .filter((t) => t.tags?.includes("stablecoin"))
    .map((t) => `${t.chainId}:${t.address.toLowerCase()}`),
);

/** True if (chainId, address) is a known, registry-tagged stablecoin. */
export const isStablecoinAddress = (chainId: number, address: string): boolean =>
  STABLECOIN_ADDRESSES.has(`${chainId}:${address.toLowerCase()}`);
```

- [ ] **Step 2: Runnable assertion**

Create `apps/mobile/scripts/_check-stable.ts`:
```typescript
import { isStablecoinAddress } from "../src/features/assets/config/tokenRegistry";
// Base Sepolia USDC must be a stablecoin; WETH must not.
if (!isStablecoinAddress(84532, "0x036CbD53842c5426634e7929541eC2318f3dCF7e")) throw new Error("usdc fail");
if (isStablecoinAddress(84532, "0x4200000000000000000000000000000000000006")) throw new Error("weth fail");
console.log("ok");
```
Run: `cd apps/mobile && npx tsx scripts/_check-stable.ts`
Expected: `ok`. Then `rm apps/mobile/scripts/_check-stable.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/assets/config/tokenRegistry.ts
git commit -m "feat(mobile): isStablecoinAddress registry helper"
```

---

## Task 2: Conditional stablecoin peg in the price provider

**Files:**
- Modify: `apps/mobile/src/features/portfolio/services/PriceProvider.ts:45-49`

This is the change that removes the balance jitter (PortfolioService values balances via this provider).

- [ ] **Step 1: Import the helper** at the top of `PriceProvider.ts`:

```typescript
import { isStablecoinAddress } from "@/src/features/assets/config/tokenRegistry";
```

- [ ] **Step 2: Apply the peg** — replace the final resolution loop (lines 45-49) with:

```typescript
    const PEG_USD = 1.0;
    const PEG_BAND = 0.02; // ±2% — outside this, show the real price (genuine depeg)

    for (const q of tokens) {
      const key = priceKey(q.chainId, q.address);
      const live = bySymbol.get(q.symbol.toUpperCase());

      if (
        q.address !== "native" &&
        isStablecoinAddress(q.chainId, q.address) &&
        (typeof live !== "number" || Math.abs(live - PEG_USD) <= PEG_BAND)
      ) {
        out.set(key, PEG_USD); // peg display to $1.00 (also covers the case where no live price exists)
        continue;
      }

      out.set(key, typeof live === "number" ? live : null);
    }
```

- [ ] **Step 3: Verify**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/portfolio/services/PriceProvider.ts
git commit -m "fix(mobile): peg tagged stablecoins to \$1.00 to stop balance jitter"
```

---

## Task 3: CoinGecko as the primary market source

**Files:**
- Modify: `apps/mobile/src/services/MarketService.ts`
- Modify: `apps/mobile/.env.example`

- [ ] **Step 1: Add env + base URL.** Replace lines 4-5 with:

```typescript
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const COINGECKO_KEY = process.env.EXPO_PUBLIC_COINGECKO_API_KEY;
```

Add to `apps/mobile/.env.example`:
```
# CoinGecko Demo API key (free: 100 calls/min, 10k/month). https://www.coingecko.com/en/api
EXPO_PUBLIC_COINGECKO_API_KEY=
```

- [ ] **Step 2: Point the axios client at CoinGecko.** Replace the `private api = axios.create({...})` block (lines 27-33) with:

```typescript
  private api = axios.create({
    baseURL: COINGECKO_BASE_URL,
    headers: { ...(COINGECKO_KEY ? { "x-cg-demo-api-key": COINGECKO_KEY } : {}) },
    timeout: 20000,
  });
```

- [ ] **Step 3: Rewrite `getTopAssets`'s primary fetch** to CoinGecko `/coins/markets` (Binance fallback unchanged). Replace the `try` block body in `fetchTask` (lines 41-46) with:

```typescript
        console.log("[MarketService] Fetching top assets from CoinGecko...");
        const response = await this.api.get(`/coins/markets`, {
          params: { vs_currency: "usd", order: "market_cap_desc", per_page: limit, page: 1 },
        });
        const assets: MarketAsset[] = response.data.map((c: any) => ({
          id: c.id,
          rank: String(c.market_cap_rank ?? "0"),
          symbol: String(c.symbol ?? "").toUpperCase(),
          name: c.name,
          supply: String(c.circulating_supply ?? "0"),
          maxSupply: c.max_supply != null ? String(c.max_supply) : null,
          marketCapUsd: String(c.market_cap ?? "0"),
          volumeUsd24Hr: String(c.total_volume ?? "0"),
          priceUsd: String(c.current_price ?? "0"),
          changePercent24Hr: String(c.price_change_percentage_24h ?? "0"),
          vwap24Hr: String(c.current_price ?? "0"),
        }));
        storageService.set(StorageKeys.TOP_ASSETS, assets);
        return assets;
```

The `catch` block (Binance fallback) stays as-is — update its log line to reference CoinGecko:
```typescript
        const isNetworkError = error.message === "Network Error" || !error.response;
        console.log(`[MarketService] CoinGecko ${isNetworkError ? "Network" : "API"} failure. Activating Binance Fallback.`);
```

- [ ] **Step 4: Verify**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/services/MarketService.ts apps/mobile/.env.example
git commit -m "feat(mobile): CoinGecko primary market source, retire dead CoinCap"
```

> `getAssetHistory`/`getAssetDetails` still target the old CoinCap paths and will fall through to Binance. Migrating them to CoinGecko `/coins/{id}/market_chart` is a follow-up; out of scope for the balance/jitter fix. The `getTopAssets` swap above is what the balance + markets list depend on.

---

## Task 4: CoinGecko attribution (required by free tier)

**Files:**
- Modify: a persistent, visible market/markets screen footer (e.g. the screen that renders the top-assets list)

- [ ] **Step 1:** Add a small footer/caption "Data provided by CoinGecko" linking to `https://www.coingecko.com/en/api` on the markets surface.
- [ ] **Step 2:** `cd apps/mobile && npx tsc --noEmit && npx expo lint` → no new errors.
- [ ] **Step 3:** `git commit -m "chore(mobile): CoinGecko attribution per free-tier terms"`

---

## Task 5: On-device verification

- [ ] **Step 1:** Set `EXPO_PUBLIC_COINGECKO_API_KEY` (free demo key) in the mobile env.
- [ ] **Step 2:** Open the app on Base Sepolia with a USDC balance. Confirm the balance now reads a **stable** "$20.00" and does not flip to $19.99/$20.01 across refreshes.
- [ ] **Step 3:** Confirm the "[MarketService] CoinCap … failure" log no longer appears (CoinGecko is primary); markets list still populates.
- [ ] **Step 4:** (Spot check) A volatile asset (ETH) still shows live, changing prices — confirms the peg is stablecoin-only.

---

## Self-Review

- **Spec coverage:** balance jitter → Task 2 (peg); dead CoinCap / every-cycle failure log → Task 3 (CoinGecko primary); attribution → Task 4. ✔
- **Depeg safety:** peg is conditional (±2% band) — a real USDC depeg shows the true price.
- **Type consistency:** `isStablecoinAddress(chainId, address)` signature matches its call in `PriceProvider`; `MarketAsset` shape preserved so `CoinCapPriceProvider` mapping by `symbol` is unaffected.
- **Note:** `CoinCapPriceProvider` keeps its class name to avoid a wide rename; only its peg behavior changes. A later rename to `MarketPriceProvider` is cosmetic.
