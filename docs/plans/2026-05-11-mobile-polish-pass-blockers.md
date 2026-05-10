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

Per Rule 2, the paymaster must sponsor **account deployment only** on the three testnets above. Subsequent UserOps are paid by the user's testnet ETH balance.

- Confirm Pimlico (or whichever paymaster vendor) is configured with sponsorship policy "first UserOp from a fresh address" or equivalent.
- Confirm `EXPO_PUBLIC_{SEPOLIA,BASE_SEPOLIA,ARB_SEPOLIA}_PAYMASTER_URL` will be populated for QA.

## Test-faucet access

Each Linked Device's predicted address must be funded with testnet ETH to pay for post-deploy UserOps. Document the faucet URL or auto-funding script per chain in this file once chosen.

---

**Until this doc is filled in, mobile work proceeds against Sepolia + Anvil only. Phases 4 (Activation sheet), 6 (Buy), 7 (Swap), 8 (Receive) ship behind a guard that hides Base Sepolia / Arb Sepolia until their deployments land.**
