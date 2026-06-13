# Cross-chain Testing Notes — discoveries + checklist

Living reference for what works today, what doesn't, and what's left to do for the Sepolia ↔ Base Sepolia end-to-end demo.

Pairs with:
- `2026-05-29-crosschain-erc20-and-polish-design.md` — design spec
- `2026-05-29-crosschain-swap-runbook.md` — deploy operator runbook
- `infra/relayer/README.md` — relayer first-time setup

---

## 1. What's actually bridgeable + swappable today

**Only USDC and WETH.** Not LINK, not DAI, not USDT, not anything else.

Native ETH auto-routes through WETH for swaps (the V3 router wraps internally), but the bridge requires explicit ERC20 (wrap your ETH to WETH first if you want to bridge it).

### Why so few — four gates that all must align

| Gate | Source | Today's contents |
|---|---|---|
| Token visible in pickers | `apps/mobile/src/features/assets/config/tokenRegistry.ts` | USDC + WETH on Sepolia / Base Sepolia / Arb Sepolia / Base mainnet |
| Same-chain swap pool | `apps/mobile/src/features/swaps/config/dexRegistry.ts` | One Uniswap V3 pool per chain: USDC ↔ WETH |
| Bridge route allowlisted | `apps/mobile/src/features/swaps/config/bridgeRegistry.ts` | `pairsBetween()`: USDC↔USDC + WETH↔WETH on every route |
| Relayer will fill the deposit | `infra/relayer/relayer.config.json` `allowedTokens` | USDC + WETH on the 3 sepolias |

Plus the implicit external gate: **Across V3's testnet route allowlist.** Even if all four of our gates pass, Across must support the token on the route. Testnet is much thinner than mainnet — adding LINK, DAI etc. for testnet bridging is genuinely hard regardless of our config.

### Currently working scenarios

| Source | Direction | Destination | Code path |
|---|---|---|---|
| USDC | Sepolia ↔ Base Sepolia | USDC | Same-asset bridge (existing) |
| WETH | Sepolia ↔ Base Sepolia | WETH | Same-asset bridge (existing) |
| USDC | Sepolia → Base Sepolia | WETH | **Cross-chain swap (new — this cycle)** |
| WETH | Sepolia → Base Sepolia | USDC | **Cross-chain swap (new — this cycle)** |
| And the same four in reverse | | | |

Once Arb Sepolia gets CCE deployed, the matrix expands to all three chains symmetrically.

### Adding a new token later

For each token (e.g. LINK) you want bridgeable + swappable:

1. Add to `tokenRegistry.ts` with chain-specific address + decimals + symbol.
2. Add a Uniswap V3 pool entry to `dexRegistry.ts` for each chain that has a real V3 pool with liquidity. Verify via factory `getPool(token, WETH, fee)` returning non-zero.
3. Add to `bridgeRegistry.ts`'s `pairsBetween()` helper.
4. Add to `infra/relayer/relayer.config.json` `allowedTokens` + fund the relayer wallet with that token on each chain it should fill.
5. **Verify Across supports the route.** If they don't, the relayer fill will revert when submitting on destination. This is the actual hard part.

---

## 2. End-to-end test plan

Prereqs in §3, §4 below. Once those are met, the actual demo flow:

| # | Action | Where | What it proves |
|---|---|---|---|
| 1 | Tap chain chip on Home → switch to **Sepolia** | App | Chain switcher works; per-chain account record loads |
| 2 | If BalanceCard says "not deployed", tap Deploy | App | DeployAccountScreen works on selected chain |
| 3 | Same on **Base Sepolia** (switch + deploy if needed) | App | Per-chain deployment tracked correctly |
| 4 | Fund smart account with ≥ 1 USDC on Sepolia | https://faucet.circle.com → send to your smart account address | You actually have USDC to bridge |
| 5 | Switch back to Sepolia → same-chain swap USDC↔WETH | DexScreen Swap tab | Regression: source-side swap pipeline still works |
| 6 | Same-asset bridge: 1 USDC Sepolia → 1 USDC Base Sepolia | DexScreen Bridge tab | Regression: SpokePool deposit + relayer fill works |
| 7 | **Cross-chain swap: 1 USDC Sepolia → WETH Base Sepolia** | DexScreen Bridge tab. Pick WETH in the new "You receive" picker. | **The new path.** Tests `BridgeDestQuoteService`, real `minOut`/`feeTier` in the BridgeMessage, executor swap, dest delivery |
| 8 | Refund path: pick an output token with no dest pool, force submit | App + look for `RefundIssued` event on executor | Tests the executor's try/catch refund path |
| 9 | Switch chain to Base Sepolia → see WETH balance arrive | App | Confirms multi-chain UX + per-chain balance refresh |

For each bridge step (6, 7, 8): watch `make relayer-logs` and confirm the relayer sees the deposit and submits the fill within ~30 seconds. If it doesn't, see §5 troubleshooting.

---

## 3. Relayer first-time setup

Full README at `infra/relayer/README.md`. Critical requirements:

| Requirement | Notes |
|---|---|
| Docker Desktop running on Windows | Only platform dep |
| **Throwaway relayer wallet** — `cast wallet new`, never reuse the deployer keystore | Private key goes in `infra/relayer/.env` as `RELAYER_PRIVATE_KEY` |
| ~0.05 ETH on each chain the relayer watches | Gas for fillRelay calls |
| ~$50 worth of USDC on each chain | Float — relayer fronts USDC to user, gets paid back on settlement |
| ~$50 worth of WETH on each chain | Same — wrap ETH via `cast send $WETH "deposit()" --value 0.02ether ...` |
| Alchemy / QuickNode RPCs preferred over public | Public RPCs throttle log subscription; relayer will silently miss deposits |

### Lifecycle commands (from `D:/trezo/contracts` in WSL)

```bash
make relayer-up        # docker compose up -d
make relayer-logs      # tail
make relayer-status    # ps
make relayer-down      # tear down
```

### What to look for in logs

- `[Sepolia] Detected new V3 deposit ...` — source detection
- `[Base Sepolia] Submitting fillRelay ...` — destination fill submitted
- `[Base Sepolia] Fill confirmed in block ...` — done

---

## 4. Outstanding TODO — what's left for the operator

Status snapshot as of this cycle:

### Confirmed done (on-chain or in-code)

- ✅ CrossChainExecutor on Base Sepolia: `0x8Fd359E1407f8c971DbB86F18fc1Ad24449237e1`
- ✅ CrossChainExecutor on Sepolia: `0x42AB0eC92D306b8385128BfC8d081b9625774693`
- ✅ Both executor immutables (spokePool, swapRouter) verified against `AcrossConfig.sol`
- ✅ Mobile deployment manifests carry the executor address
- ✅ Bridge backend code wired (dest-quote, real `minOut`/`feeTier`)
- ✅ Bridge UI: destination output-token picker + dest-swap details rendered
- ✅ Chain switcher on Home + Portfolio headers (just landed)
- ✅ `EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL` and `EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL` confirmed in `apps/mobile/.env`
- ✅ TypeScript: 0 errors in any file this cycle touched

### Operator still needs to

1. **Merge `swaps/crosschain-erc20` → `feat/mobile-polish-pass`.** From `D:/trezo` (main worktree), not from this worktree: `git checkout feat/mobile-polish-pass && git merge --no-ff swaps/crosschain-erc20`.
2. **Set up the relayer** per §3 above. Slowest step (~15 min of faucet waiting + wallet funding).
3. **Fund the user smart account with ≥ 1 USDC on Sepolia.** Circle faucet, send to your smart account address.
4. **(Later, optional)** Deploy CCE on Arb Sepolia via `make deploy-arb-sepolia` to complete the 3-chain matrix. Not required for the Sepolia ↔ Base Sepolia demo.

### Not blocking but flagged

- **6 pre-existing TypeScript errors** on `feat/mobile-polish-pass` in files this cycle did not touch:
  - `home/components/dashboard/AssetList.tsx:137` — nullable number
  - `home/hooks/useDashboardData.ts:37` — wrong arg count
  - `portfolio/components/TokenDetailModal.tsx:130, 135` — nullable `token.value`
  - `profile/screens/EmailRecoveryStartScreen.tsx:314` — undefined `colors`
  
  Expo bundler is more permissive than `tsc --noEmit` so these won't block runtime. Worth a cleanup PR after the demo.

---

## 5. Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Mobile throws "Cross-chain swap requires CrossChainExecutor on …" | Dest chain manifest missing `crossChainExecutor` field | Re-run `make deploy-<chain>` + `make sync-mobile` — the `DeployEmailRecovery` preservation fix is now in place |
| Mobile throws "No Uniswap V3 pool on … for canonical → outputToken" | Pair not in `dexRegistry.ts` for that chain | Add the pool entry; verify via factory.getPool() that the pool actually exists with liquidity |
| Deposit lands on source but never settles on destination | Relayer not running, not funded, or rate-limited by public RPC | `make relayer-status`; check float balances; switch to Alchemy RPC |
| Bridge UserOp fails with "Insufficient input token balance" | Smart account doesn't have enough of the input token on source chain | Top up via faucet, send to the smart account address |
| Bridge tab "You receive" picker is disabled / says "same-asset only on this dest" | `crossChainSwapSupported` is false for that dest — CCE not deployed there | Deploy CCE on the destination chain |
| BalanceCard shows "Deploy" button even though account is deployed on another chain | Per-chain deployment tracking — switch chain to the one where it's actually deployed, or tap Deploy to deploy on the current chain | This is expected; smart account has the same address everywhere but proxy must be deployed per chain |
| `make deploy-X` reverts on `check-spokepool` | SpokePool pin in `AcrossConfig.sol` is stale | Update from across-protocol/contracts/deployments |

---

## 6. Future work (out of scope this cycle)

Captured here so we don't lose the thread:

- **Aggregator integration (deferred per project memory)** — spec mandates DEX aggregator (1inch / 0x) + cross-chain routing API (LI.FI / Socket / Squid). Current architecture is single-venue Uniswap V3 + direct Across. Big rewrite of `SwapQuoteService` + `BridgePreparationService` when picked back up.
- **Destination-side fill notification.** Today the mobile app marks a bridge `confirmed` on source-chain receipt. Destination fill is async and the UI has no signal for it. The Ponder indexer in `apps/backend/indexer/` can be extended to emit a `BridgeFilled` notification when CCE emits `SwapExecuted` or `RefundIssued`.
- **Replace flat-fee local compute with Across hosted `/suggested-fees` API** for mainnet — current `BRIDGE_FLAT_FEE_BPS = 30` is fine for testnet because we run the only relayer.
- **Audit CCE before mainnet** — single-file contract but holds bridged funds in flight; the refund path is the safety net.
