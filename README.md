# Trezo Wallet

Passkey-first smart contract wallet built on ERC-4337 and ERC-7579-style modules. The repo combines a React Native Expo client, Foundry contracts, and a local AA stack for end-to-end wallet flows.

## Highlights
- WebAuthn **passkey authentication** with device biometrics
- **ERC-4337 smart accounts** with modular validator / executor installation
- **Passkey rotation** through social recovery and custom zk-email recovery
- Local **AA development stack** (Anvil + Alto bundler + mock paymaster)
- **Supabase backend** for app data and auth

## Repository Layout
- `apps/mobile` - Expo client, AA bundler config in `Bundler/`, and Supabase assets in `supabase/`
- `contracts` - Foundry project with the smart account, passkey validator, recovery modules, scripts, and tests

## Quick Start (Local)
1) **Fetch submodules**
   ```bash
   git submodule update --init --recursive
   ```
2) **Install contract-side npm dependencies**
   ```bash
   cd contracts
   npm ci
   cd ..
   ```
   This is required for the zk-email contract packages used by `EmailRecovery`.
3) **Configure the mobile app**
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   ```
   Fill in the required Supabase, Moralis, RPC, and bundler values. Keep real credentials out of git.
4) **Run the local AA stack**
   ```bash
   cd apps/mobile/Bundler
   docker compose up -d
   ```
5) **Deploy contracts to local Anvil**
   ```bash
   cd contracts
   make deploy-local
   make deploy-email-local
   ```
   `deploy-local` deploys the account stack. `deploy-email-local` deploys or reuses the zk-email infra plus Trezo's custom `EmailRecovery` module, then syncs artifacts to mobile.
6) **Run tests**
   ```bash
   cd contracts
   forge test -vv
   ```
7) **Start the mobile app**
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```

## Smart Contract Components
- **SmartAccount** - ERC-4337 entry point integration, module install/uninstall, ERC-1271 support, and recovery-module authorization
- **PasskeyValidator** - WebAuthn / RIP-7212 validation with sign-counter enforcement and multi-passkey support
- **SocialRecovery** - guardian approvals over new passkey payloads with a timelock
- **EmailRecovery** - custom zk-email recovery module that lets guardians approve a passkey rotation by email
- **AccountFactory & MinimalProxyFactory** - deterministic account deployment via CREATE2 and minimal proxies

## Recovery Model
- **SocialRecovery** is fully onchain and guardian-signature based.
- **EmailRecovery** uses zk-email infra (`Verifier`, `UserOverrideableDKIMRegistry`, `EmailAuth`) plus Trezo's custom recovery executor.
- The repo deploys the custom module itself. The email relayer / prover stack is separate from this repo.

## Security & Secrets
- `.env` files stay out of git; use examples/templates where available.
- Dev keys in the local bundler stack are public test keys only.
- Production DKIM config, relayer credentials, and funded broadcaster keys must be managed separately from this repo.

## Tooling
- Mobile: Expo SDK 54 / React Native 0.81, NativeWind, viem/ethers, Supabase JS
- Contracts: Foundry, modulekit, OpenZeppelin, WebAuthn-sol, zk-email contracts
- Local AA: Docker Compose (Anvil, Pimlico Alto, mock paymaster, contract deployer)

