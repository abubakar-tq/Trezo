# Trezo Wallet

Passkey-first smart contract wallet built on ERC-4337/7579. This monorepo pairs a React Native Expo client with Foundry-based smart contracts, plus a Dockerized bundler stack for local AA testing.

## Highlights
- WebAuthn **passkey authentication** with device biometrics for login and recovery
- **ERC-4337 smart accounts** with ERC-7579-style module management (validators/executors)
- **Social recovery** module for guardian-approved passkey rotation
- Local **AA dev stack** (Anvil + Pimlico Alto + mock paymaster) via Docker Compose
- **Supabase backend** for auth, profiles, and storage

## Repository Layout
- `apps/mobile` – Expo client, AA bundler (`Bundler/`), and Supabase migrations (`supabase/`)
- `contracts` – Foundry project with the smart account, passkey validator, and recovery module

## Quick Start (Local)
1) **Fetch dependencies**
   ```bash
   git submodule update --init --recursive
   ```
2) **Configure the app**
   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   # Fill in Supabase URL/key, Moralis key, RP ID, and RPC URLs
   ```
   Keep real credentials in `.env`; do not commit them.
3) **Run the AA stack** (Anvil + Alto bundler + mock paymaster)
   ```bash
   cd apps/mobile/Bundler
   docker compose up -d
   ```
4) **Start the mobile app**
   ```bash
   cd apps/mobile
   npm install
   npx expo start
   ```
   Choose `a`/`i` for device targets. The app expects the bundler on `http://localhost:4337` and RPC on `http://localhost:8545`.
5) **Smart contracts**
   ```bash
   cd contracts
   forge build
   forge test -vv
   ```

## Smart Contract Components
- **SmartAccount** – ERC-4337 entry point integration with ERC-7579 module manager
- **PasskeyValidator** – WebAuthn/RIP-7212 validation with rpId binding and counters
- **SocialRecovery** – Guardian-set approvals (EIP-712) with timelock to rotate/add passkeys
- **AccountFactory & MinimalProxyFactory** – CREATE2 deterministic deployments and minimal proxies

## Security & Secrets
- `.env` files stay out of git (see `.gitignore`). Use `.env.example` as a template.
- Current local `.env` includes real Supabase and Moralis keys; rotate before publishing the repo.
- Test private keys in `Bundler/` are public dev keys only—never reuse in production.

## Tooling
- Mobile: Expo SDK 54 / React Native 0.81, NativeWind, viem/ethers, Supabase JS
- Contracts: Foundry + modulekit, OpenZeppelin, WebAuthn-sol
- Local AA: Docker Compose (Anvil, Pimlico Alto, mock paymaster, contract deployer)


