# Core Architecture

Business logic shared across the Trezo smart wallet.

## Modules

### `auth/`
- Biometrics: gate access to the local device key via SecureStore
- Passkeys: WebAuthn helpers for login/recovery with the backend

### `network/`
- Chain metadata and RPC selection
- Contract addresses for the AA stack

## Security Model
1. **Passkeys (WebAuthn)** are the sole credential for owning the smart account. The private key lives in the device secure enclave; only public metadata (credentialIdRaw, publicKeyX/Y, rpIdHash) is stored in AsyncStorage.
2. **Biometrics** (FaceID/TouchID/Android biometrics) gate passkey creation/use via the platform auth prompt.
3. **No local EOA/seed** is generated or stored; all account ownership flows are passkey-based.
4. Contract addresses are injected per-network (Anvil via deployment JSON; testnet/mainnet via env) and validated at startup.
