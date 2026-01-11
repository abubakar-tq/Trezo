# Trezo Wallet (Mobile)

React Native Expo client for the Trezo smart contract wallet. The app pairs WebAuthn passkeys with ERC-4337 account abstraction and a local AA stack for development.

## Feature Highlights
- **Passkey authentication** (WebAuthn + device biometrics) for login and recovery
- **ERC-4337 smart account** flows wired to a local bundler/paymaster stack
- **Supabase** auth, profiles, and storage integration
- **NativeWind UI** with shared feature modules and viem/ethers tooling

## Prerequisites
- Node 18+ and npm
- Expo CLI (`npx expo`) with iOS/Android SDKs or emulators
- Docker + Docker Compose for the local AA stack

## Setup
1) **Environment**
   ```bash
   cp .env.example .env
   # Fill SUPABASE, MORALIS, RP ID, and RPC URLs (see comments in .env.example)
   ```
2) **Install dependencies**
   ```bash
   npm install
   ```
3) **Start the local AA stack**
   ```bash
   cd Bundler
   docker compose up -d
   ```
   Services: Anvil (8545), Alto bundler (4337), mock paymaster (3000).
4) **Run the app**
   ```bash
   cd ..
   npx expo start     # press a/i to launch Android/iOS
   ```
5) **Supabase migrations (optional)**
   ```bash
   cd supabase
   npx supabase migration up
   ```

## Project Structure
```
app/            # Expo router entry
src/
├─ core/        # Auth (biometrics/passkeys), wallet key store, network config
├─ features/    # UI + business features
├─ integration/ # viem clients, ABIs, chain config
├─ shared/      # Reusable UI
└─ theme/       # Design tokens and styling
Bundler/        # Docker AA stack
supabase/       # Database migrations/config
```

## Commands
- `npm start` / `npx expo start` – dev server
- `npm run android` / `npm run ios` – device builds
- `npm run lint` – linting

## Security Notes
- Keep `.env` out of version control (already gitignored). Use `.env.example` for sharing.
- The local `.env` currently holds real Supabase and Moralis keys; rotate before publishing the repo.
- Passkey RP ID must match your domain and `.well-known` assets for platform binding.

## License
License not set. Choose one (e.g., MIT/Apache-2.0) before releasing publicly.
