# Trezo Wallet — Contracts

Foundry project powering the Trezo smart wallet. Implements an ERC-4337/7579 smart account with WebAuthn passkey validation and a guardian-based social recovery flow.

## Architecture
- **SmartAccount** (`src/account/SmartAccount.sol`) – ERC-4337 entry point integration with ERC-7579 module routing, ERC-1271 signatures, and module install/uninstall helpers.
- **Factories** – `AccountFactory` for CREATE2 deterministic deployments and `MinimalProxyFactory` for cheap clones.
- **Storage & Types** – `AccountStorage` and shared `Types` for passkey payloads and module bookkeeping.

## Modules
- **PasskeyValidator** (`src/modules/passkey/PasskeyValidator.sol`)  
  - WebAuthn/RIP-7212 signature checks (rpId binding, sign-counter monotonicity)  
  - Supports ERC-4337 `validateUserOp` and ERC-1271 verification  
  - Add/remove passkeys per account with enumerable tracking
- **SocialRecovery** (`src/modules/SocialRecovery/SocialRecovery.sol`)  
  - Guardian set + threshold configured at install time  
  - EIP-712 approvals for new passkey payloads  
  - Timelocked execution and module authorization checks before rotating keys

## Layout
```
contracts/
├─ src/
│  ├─ account/          # Smart account + module manager
│  ├─ factory/          # AccountFactory
│  ├─ proxy/            # MinimalProxyFactory
│  ├─ modules/          # Passkey + social recovery modules
│  ├─ interfaces/       # Public interfaces
│  └─ utils/            # WebAuthn helpers
├─ lib/                 # Submodules (OpenZeppelin, modulekit, AA, etc.)
├─ script/
├─ test/
└─ foundry.toml
```

## Development
Requires [Foundry](https://book.getfoundry.sh/) and git submodules.

```bash
git submodule update --init --recursive
forge build
forge test -vv
```

## Deployment (local)
```bash
anvil &
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

## Notes
- Bundler integration targets ERC-4337 EntryPoint v0.7 (see mobile bundler config).
- The passkey module expects SHA-256(RP ID) binding and enforces WebAuthn user verification.
- Social recovery calls back into the account to add a new passkey; ensure the module is marked as authorized recovery in the account.
