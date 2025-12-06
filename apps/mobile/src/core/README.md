# Core Architecture

This directory contains the business logic for the Trezo Smart Wallet.

## Modules

### `auth/`
Handles user authentication.
- **Biometrics**: Unlocking the local device key.
- **Passkeys**: WebAuthn credentials for backend login and account recovery.

### `wallet/`
Manages the cryptographic keys.
- **Signer**: The local EOA (Externally Owned Account) stored in SecureStore.
- **Key Generation**: Creating the initial signer key.

### `aa/` (Account Abstraction)
Handles ERC-4337 Smart Account logic.
- **UserOps**: Constructing and signing UserOperations.
- **Bundler**: Submitting UserOps to the Alto Bundler.
- **Paymaster**: Handling gas sponsorship.

### `network/`
Blockchain configuration.
- **Chain Config**: RPC URLs, Contract Addresses.

## Security Model

1. **Device Key**: A unique private key is generated on the device and stored in `Expo SecureStore`.
2. **Smart Account**: This Device Key is the `owner` of the on-chain Smart Account.
3. **Protection**: Access to the Device Key is guarded by Biometrics (FaceID/Fingerprint).
4. **Recovery**: Passkeys (synced via iCloud/Google Password Manager) authenticate the user to the backend to restore access or trigger a recovery procedure (Social Recovery).
