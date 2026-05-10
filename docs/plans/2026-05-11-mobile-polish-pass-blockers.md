# Mobile Polish Pass — Cross-team Blockers

This polish pass restricts wallet ops to four chains per the brief §4.1:

- 11155111 — Ethereum Sepolia
- 84532   — Base Sepolia
- 421614  — Arbitrum Sepolia
- 31337   — Anvil

Today only **Sepolia (env-gated)** and **Anvil** are wired end-to-end. Before user-facing copy in Phases 4, 7, 8 can ship truthfully, the following must be resolved by the contracts / infra team:

## Contract deployments

| Chain | SmartAccount | AccountFactory | PasskeyValidator | SocialRecovery | EmailRecovery |
|---|---|---|---|---|---|
| Sepolia (11155111) | ? | ? | ? | ? | ? |
| Base Sepolia (84532) | missing | missing | missing | missing | missing |
| Arb Sepolia (421614) | missing | missing | missing | missing | missing |

Fill in the "?" cells from `contracts/deployments/`. The mobile team will run `make sync-mobile` / `make sync-abi` from `contracts/` once deployments land.

## Paymaster sponsorship

| Chain | Paymaster URL env var | Static config wired? | Activation sheet passes URL? | Runtime sponsorship verified? |
|---|---|---|---|---|
| Sepolia (11155111) | `EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL` | yes (via chains.ts line 122) | yes (via `getChainConfig(chainId)?.paymasterUrl`) | **pending user smoke** |
| Base Sepolia (84532) | `EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL` | yes (via chains.ts line 139) | yes (same code path) | **pending user smoke** |
| Arb Sepolia (421614) | `EXPO_PUBLIC_ARB_SEPOLIA_PAYMASTER_URL` | yes (via chains.ts line 156) | yes (same code path) | **pending user smoke** |
| Anvil (31337) | (`apps/backend/bundler` mock-paymaster on localhost:3000) | yes (default URL via chains.ts line 111) | yes | **pending user smoke** |

**How to verify at runtime:**

1. From `apps/backend/bundler/` run `docker compose up`. Confirm `alto` + `mock-paymaster` start.
2. Run the mobile app: `npm run android`.
3. Trigger an activation on Anvil (Send / Swap / Buy tap with the account not Active).
4. In the bundler logs (`docker compose logs -f alto`), confirm the UserOp is accepted with a paymaster signature.
5. Repeat for Sepolia (if env vars set). For Base Sepolia / Arb Sepolia, see Contract deployments above — also blocked.

**Until runtime sponsorship is confirmed**, Activation sheet copy must not promise "free" or "sponsored" gas. The current sheet body says nothing about gas (intentional) — keep it that way.

## Test-faucet access

Each Linked Device's predicted address must be funded with testnet ETH to pay for post-deploy UserOps. Document the faucet URL or auto-funding script per chain in this file once chosen.

---

**Until this doc is filled in, mobile work proceeds against Sepolia + Anvil only. Phases 4 (Activation sheet), 6 (Buy), 7 (Swap), 8 (Receive) ship behind a guard that hides Base Sepolia / Arb Sepolia until their deployments land.**
