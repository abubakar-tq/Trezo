# Core Architecture

Business logic shared across the Trezo smart wallet.

## Modules

### `auth/`
- Biometrics: gate access to the local device key via SecureStore
- Passkeys: WebAuthn helpers for login/recovery with the backend

### `wallet/`
- Device key generation and persistence
- Local signer management (EOA stored in SecureStore)

### `network/`
- Chain metadata and RPC selection
- Contract addresses for the AA stack

## Security Model
1. **Device Key** is generated on-device and stored in `Expo SecureStore`.
2. That key owns the smart account on-chain.
3. **Biometrics** protect access to the device key.
4. **Passkeys** provide cloud-synced authentication to restore or rotate keys via social recovery on the smart account.
