# Trezo Wallet

Passkey-first smart contract wallet built on ERC-4337 and ERC-7579-style modules. The repository is a comprehensive monorepo combining a React Native Expo client, Foundry contracts, web applications, and backend services to deliver a complete Account Abstraction (AA) ecosystem.

## Highlights
- WebAuthn **passkey authentication** with device biometrics and RIP-7212 precompiles
- **ERC-4337 smart accounts** with modular validator / executor installation
- **Passkey rotation** through social recovery and custom zk-email recovery
- Local **AA development stack** (Anvil + Alto bundler + mock paymaster)
- **Supabase backend** for app data, auth, edge functions, and RLS policies
- **Multi-chain operations** including Cross-chain swaps via Across Protocol
- **Fiat Onramp** via Transak integrations

---

## 🏗️ Architecture & Component Connections

To understand what is connected to what, here is the component breakdown:

1. **Mobile App (`apps/mobile`)**
   - **Role**: Primary user interface.
   - **Connections**: 
     - **Supabase**: Connects for user authentication, deterministic wallet generation data, and profile syncing.
     - **Alto Bundler & Anvil (via `viem`)**: Submits ERC-4337 UserOperations directly to the bundler/node.
     - **Transak**: Launches a secure WebView for fiat onramps.

2. **Chrome Extension (`apps/extension`)**
   - **Role**: Serves as a paired device sharing the mobile app's smart account.
   - **Connections**: Injects providers into Web3 dApps (like Uniswap) and proxies signature requests back to the smart account via the Bundler using the user's passkey.

3. **Guardian Approval App (`apps/guardian-approval`)**
   - **Role**: Web interface for guardians.
   - **Connections**: Connects to the backend to approve social recovery requests initiated by the mobile app.

4. **Supabase Edge Functions (`apps/backend/supabase/functions`)**
   - **Role**: Secure backend orchestrator.
   - **Connections**: 
     - **Transak Webhooks**: Verifies signed JWT webhooks from Transak using Partner Access Tokens to process onramp fulfillments.
     - **On-chain fulfillment**: The backend runs a `LocalFulfillmentService` to mint test ETH/USDC on local Anvil, or uses `TestnetFulfillmentService` to deliver assets on testnets.
     - **Notifications & Recovery**: Handles push notifications and securely canceling expired email recovery attempts.

5. **ZK Email Relayer & API (`apps/backend/zk-email-recovery-api`)**
   - **Role**: Processes email-based recovery.
   - **Connections**: Listens to guardian emails, produces ZK proofs, and submits `handleRecovery` transactions directly to the `EmailRecovery.sol` contract on-chain.

6. **Contracts (`contracts`)**
   - **Role**: The source of truth on the blockchain.
   - **Connections**: Contains the `SmartAccount.sol` entry points, validators (`PasskeyValidator.sol`), and executors (`EmailRecovery.sol`, `SocialRecovery.sol`).

---

## 💳 Transak Fiat Onramp Integration

The fiat onramp is a fully functional testnet/local pipeline:
1. **Session Creation**: The mobile app requests an onramp session. The Supabase Edge Function (`onramp-session`) securely creates a signed Transak widget URL.
2. **Purchase**: The user completes the flow in the mobile WebView.
3. **Webhooks & Verification**: Transak fires a webhook to the `onramp-webhook` edge function. The data payload is a JWT signed using the Partner Access Token. The Edge function strictly **verifies the JWT signature**. Unsigned client nudges are only used for UX hints and never trusted for fund delivery.
4. **Fulfillment**: 
   - If running locally (`chainId: 31337`), `LocalFulfillmentService` automatically mints mock ETH or USDC to the user's smart account via Anvil.
   - On testnets, `TestnetFulfillmentService` dispenses testnet funds from a treasury wallet.

---

## 🚀 App Installation & Setup Guide

### Prerequisites
- Node.js & npm
- Docker (for the local AA stack)
- Foundry (for smart contracts)
- Expo CLI

### 1. Root Initialization
Fetch all submodules (critical for zk-email contract dependencies) and install root dependencies:
```bash
git submodule update --init --recursive
npm install
```
*Note: The `npm install` triggers the `postinstall` script (`scripts/link-contract-node-modules.sh`) which correctly links Foundry node modules inside the monorepo.*

### 2. Local Backend & AA Stack Setup
Start the Supabase backend and edge functions:
```bash
./scripts/infra-up.sh
```
Start the local AA stack (Anvil, Alto Bundler, Paymaster):
```bash
cd apps/backend/bundler
docker compose up -d
```

### 3. Deploy Contracts Locally
Deploy the core smart accounts and email recovery modules to Anvil:
```bash
cd contracts
make deploy-local
make deploy-email-local
```
*(This automatically syncs the generated ABIs and deployment JSONs into the mobile app's integration folders).*

### 4. Running the Applications

**Environment Setup:** Run `./scripts/infra-export-mobile-env.sh` (or `cp apps/mobile/.env.example apps/mobile/.env` and manually fill the values) to configure your connection strings.

**Mobile App:**
```bash
cd apps/mobile
npx expo start
```
*(Press `a` for Android, `i` for iOS, or use Expo Go).*

**Chrome Extension:**
```bash
npm run -w apps/extension build
```
*(Load the `apps/extension/dist` folder as an unpacked extension in `chrome://extensions` and pair your device).*

**Guardian App & Indexer:**
```bash
npm run -w apps/guardian-approval dev
npm run -w apps/backend/indexer dev
```

---

## 📜 Helper Scripts & Makefiles Deep Dive

The repository contains numerous utility scripts to streamline development:

### Root Scripts (`scripts/`)
- `infra-up.sh`: Bootstraps the local Supabase instance, automatically generates a runtime `.env` file for Edge Functions, and runs `supabase functions serve` in the background. It also supports syncing user data from remote databases.
- `infra-down.sh`: Safely spins down the local Supabase instance and kills background edge functions.
- `infra-export-mobile-env.sh` / `supabase-local-mobile-env.sh`: Injects the active local Supabase connection strings right into the mobile app's `.env` file.
- `link-contract-node-modules.sh`: A workaround for symlinking Foundry's `node_modules` (specifically `modulekit`) when working on Windows/WSL environments.
- `fork/` folder: Contains scripts (`start-fork-and-bundler.sh`, `seed-base-swap-wallet.sh`, `auto-fund-accounts.sh`) designed to spin up a local fork of the Base Mainnet, funding wallets automatically so you can test realistic DeFi swaps.

### Makefiles
- **Root `Makefile`**: Provides fast targets for the Base Mainnet fork workflow. E.g., `make fork-base`, `make bundler-fork-base`, `make seed-fork-swap-wallet`, and `make check-balance-fork-base`.
- **Contracts `contracts/Makefile`**: The massive engine for deterministic deployments using Safe's singleton factory. It supports `make deploy-local`, `make deploy-sepolia`, checking chain support, deploying the email recovery testing harness (`make deploy-email-recovery-local-harness`), and spinning up the self-hosted Across relayer (`make relayer-up`).

---

## 🌍 Current Production Deployment

The Trezo ecosystem relies on a distributed modern cloud infrastructure for its production deployments:

- **Mobile App (`apps/mobile`)**: Built and deployed using **Expo Cloud (EAS)**. Push notifications are securely routed to devices using Firebase Cloud Messaging (**FCM**).
- **Backend Database & Auth**: **Supabase** serves as the primary production database, handling Postgres, authentication, and Edge Functions.
- **On-chain Indexer (`apps/backend/indexer`)**: The Ponder-based indexer is deployed and hosted on **Railway**.
- **Guardian Approval Web App (`apps/guardian-approval`)**: The React/Vite interface for external guardians is deployed on **Vercel** for global edge performance.

---

## Security & Secrets
- `.env` files must stay out of git; use examples/templates where available.
- Dev keys in the local bundler stack are public test keys only.
- Production DKIM config, relayer credentials, and funded broadcaster keys must be managed separately from this repo.
- For detailed smart contract security constraints, review the context rules within the specific module directories.
