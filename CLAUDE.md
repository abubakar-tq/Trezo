# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Trezo Wallet — passkey-first ERC-4337 smart contract wallet. npm workspaces monorepo with three apps plus a Foundry contracts package.

```
apps/mobile              Expo SDK 54 / RN 0.81 client (workspace: trezo_wallet)
apps/backend             Supabase (DB + edge functions) + local AA bundler stack
apps/guardian-approval   Vite/React web app for guardians to approve recovery
contracts                Foundry project (smart account + modules + scripts + tests)
```

The mobile app, contracts, and bundler are tightly coupled: contract deploy scripts write artifacts that the mobile integration layer reads at runtime.

## Common commands

Run from the repo root unless noted. The repo is npm workspaces — use `npm --workspace <pkg>` or `cd` into the workspace.

### Mobile (`apps/mobile`)
```
npm run start                        # workspace-root alias for `expo start`
npm --workspace apps/mobile run android
npm --workspace apps/mobile run ios
npm --workspace apps/mobile run lint # expo lint (eslint)
```
There is no test runner configured for the mobile app.

### Contracts (`contracts/`, Foundry)
```
make build                           # forge build
forge test -vv                       # all tests
forge test --match-test <name> -vvv  # single test
make deploy-local                    # deploy account stack to local Anvil
make deploy-email-local              # deploy/reuse zk-email infra + EmailRecovery (also syncs ABIs/JSON to mobile)
make deploy-sepolia PRIVATE_KEY=...  # alias of deploy-infra-sepolia
make sync-mobile                     # copy deployment artifacts to apps/mobile/src/integration
make sync-abi                        # copy ABIs only
make help                            # full list of targets (predict-*/verify-*/check-*)
```
Local dev/harness targets (`mock-*`, `test-email-recovery-harness`, `deploy-email-recovery-local-harness`) exist for running EmailRecovery flows against Anvil without the real relayer/prover. Never run harness targets against testnet/prod.

### Local AA stack (`apps/backend/bundler`)
```
docker compose up -d                 # Anvil + Pimlico Alto bundler + mock paymaster + deployer
./save-state.sh / ./restore-state.sh # snapshot anvil state
```

### Supabase (`apps/backend/supabase`)
```
npx supabase migration new <name>
npx supabase db push                 # apply migrations
npx supabase migration list
./scripts/infra-up.sh                # local stack + edge functions serve (sets up .temp/functions-runtime.env)
```
Edge functions live in `apps/backend/supabase/functions/` (Deno). Function-only secrets (e.g. `RECOVERY_RELAYER_PRIVATE_KEY`) belong in `functions/.env.local`.

### Guardian-approval web app (`apps/guardian-approval`)
```
npm --workspace apps/guardian-approval run dev / build / lint
```

## Architecture

ARCHITECTURE.md has Mermaid diagrams for each layer. Key cross-cutting facts that aren't obvious from one file:

### Contract → mobile artifact pipeline
`contracts/script/Deploy*.s.sol` writes JSON (e.g. `deployments/31337.json`) and the Makefile's `sync-mobile`/`deploy-*-local` targets copy ABIs and deployment JSON into `apps/mobile/src/integration/`:
- `apps/mobile/src/integration/abi/` — 6 contract ABIs
- `apps/mobile/src/integration/contracts/deployment.<chainId>.json` — addresses keyed by chain
- `apps/mobile/src/integration/viem/deployments.ts` reads these at runtime
After re-deploying contracts, mobile will pick up new addresses *only if* the sync step ran. `deploy-email-local` and `deploy-local` both invoke sync; manual `forge script` calls do not.

### UserOp assembly lives in `viem/userOps.ts`
The 40KB file `apps/mobile/src/integration/viem/userOps.ts` is the central UserOp builder used by every wallet-mutation flow (account deploy, module install/uninstall, recovery, send). When changing contract calldata shapes (e.g. validator/executor signatures, module install flows), this file usually needs a matching update. `viem/clients.ts` wires the bundler/RPC endpoints from `core/network/chain.ts`.

### Account & module model
- `SmartAccount` (ERC-4337 + ERC-1271) installs ERC-7579-style modules via `ModuleManager`.
- `PasskeyValidator` validates WebAuthn / RIP-7212 signatures with sign-counter enforcement; multiple passkeys per account.
- `SocialRecovery` and `EmailRecovery` are *executor* modules that authorize passkey rotation. They share the install path through `ModuleManager` but differ in storage:
  - SocialRecovery stores raw guardian addresses onchain.
  - EmailRecovery stores derived `EmailAuth` addresses (zk-email); raw emails are kept offchain in Supabase.
- The repo deploys the `EmailRecovery` module itself; the relayer/prover stack that calls `handleAcceptance / handleRecovery / completeRecovery` is external (out of scope).

### Mobile feature/service boundaries
- `apps/mobile/src/features/` is feature-sliced (auth, wallet, recovery, home, portfolio, browser, dex, contacts, profile, settings, dev).
- `apps/mobile/src/features/wallet/services/` contains the wallet-specific orchestration: `AAWalletService`, `AccountDeploymentService`, `EmailRecoveryService`, `PasskeyAccountService`, `PasskeyService`, `SocialRecoveryService`, `SupabaseWalletService`, `WalletService`.
- `apps/mobile/src/services/` contains cross-feature services (e.g. `RampService`).
- Global Zustand stores live in `apps/mobile/src/store/` (auth flow, app lock, appearance, browser, market, recovery status, user). Feature-local stores live under `features/*/store/`.
- Network/chain config: `apps/mobile/src/core/network/chain.ts` (RPC + bundler endpoints), `core/network/contracts.ts` (address resolution).

### Supabase
Migrations live in `apps/backend/supabase/migrations/` (timestamped). RLS lives in a separate `CONSOLIDATED_RLS_POLICIES.sql` file rather than per-migration. Mobile-side Supabase usage goes through `apps/mobile/src/lib/supabase.ts` (client init), `lib/oauth.ts`, and `features/*/services/*Sync*.ts` for syncing wallet/profile/guardian data.

### Onramp (active feature)
Active branch work is in `feat/onramp` — see `docs/plans/2026-05-02-on-ramp-integration.md`. Edge functions `onramp-session`, `onramp-webhook`, `dev-mock-complete`, plus `_shared/ramp/` (factory + provider implementations including `TransakProvider` and `LocalFulfillmentService`) implement the ramp flow. Mobile side: `apps/mobile/src/services/RampService.ts`, `features/wallet/screens/BuyScreen.tsx`, `features/wallet/components/ramp/`.

## Conventions worth knowing

- `.gitignore` ignores `docs/*` (most docs are not committed) but `docs/plans/` and `docs/ARCHITECTURE.md` are tracked. Don't assume new files under `docs/` will be committed without checking.
- `contracts/lib/` (Foundry deps) and `contracts/lib/modulekit` are git submodules. `git submodule update --init --recursive` is required before first build.
- Real `.env` files are gitignored everywhere; only `*.env.example` files should be committed.
- Local-bundler private keys in `apps/backend/bundler/` and `DEFAULT_ANVIL_KEY` in the contracts Makefile are public Anvil test keys — safe in repo. Production keys (relayer, broadcaster, DKIM) are managed outside this repo.
- The mobile app uses NativeWind (Tailwind for RN). Styling goes through `className` props, not StyleSheet.
- viem is the primary EVM client; ethers is also present (some legacy / specific paths).

## Out of scope in this repo

- Email relayer / zk-email prover service (separate codebase).
- Production recovery operations / monitoring.
- Funded broadcaster orchestration for testnet/mainnet deploys.
