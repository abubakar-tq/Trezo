# Trezo Wallet - Contracts

Foundry project for Trezo's ERC-4337 smart wallet. The contract system combines a modular smart account, a passkey validator, and two recovery paths: social recovery and a custom zk-email recovery module.

## Architecture
- **SmartAccount** (`src/account/SmartAccount.sol`)
  - ERC-4337 EntryPoint integration
  - ERC-7579-style module install / uninstall / routing
  - ERC-1271 signature support
  - explicit recovery-module authorization for passkey rotation
- **Factories**
  - `AccountFactory` for deterministic CREATE2 account deployment
  - `MinimalProxyFactory` for minimal-proxy clones of the account implementation
- **Shared Types**
  - `src/common/Types.sol` defines the passkey payloads used across validator and recovery flows

## Modules
- **PasskeyValidator** (`src/modules/passkey/PasskeyValidator.sol`)
  - validates WebAuthn / RIP-7212 signatures
  - enforces sign-counter freshness
  - supports ERC-4337 `validateUserOp` and ERC-1271
  - manages multiple passkeys per account
- **SocialRecovery** (`src/modules/SocialRecovery/SocialRecovery.sol`)
  - guardian set and threshold configured at install time
  - EIP-712 approvals over a new passkey payload
  - timelocked execution through an explicitly authorized recovery executor
- **EmailRecovery** (`src/modules/EmailRecovery/EmailRecovery.sol`)
  - custom Trezo module built on top of zk-email's `EmailRecoveryManager`
  - guardians approve a `recoveryDataHash` by email
  - on completion, installs a new passkey through `SmartAccount.addPasskeyFromRecovery`

## Layout
```text
contracts/
├─ src/
│  ├─ account/          # Smart account and module manager
│  ├─ common/           # Shared types
│  ├─ factory/          # AccountFactory
│  ├─ modules/          # Passkey, social recovery, email recovery
│  ├─ proxy/            # MinimalProxyFactory
│  └─ utils/            # Passkey / WebAuthn helpers
├─ script/              # Deployment scripts
├─ test/                # Forge tests
├─ lib/                 # Foundry submodules
├─ package.json         # zk-email npm dependency
└─ foundry.toml
```

## Prerequisites
- [Foundry](https://book.getfoundry.sh/)
- git submodules
- `npm` for the zk-email Solidity package dependency

## Bootstrap
```bash
git submodule update --init --recursive
cd contracts
npm ci
forge build
forge test -vv
```

## Legacy Local/Test Flow
This repo keeps a legacy local/test deployment flow for Anvil-based development.

```bash
cd contracts
make deploy-local
make deploy-email-local
```

What they do:
- `deploy-local`
  - aliases the legacy local/test flow
  - deploys `SmartAccount`, `AccountFactory`, `MinimalProxyFactory`, `PasskeyValidator`, and `SocialRecovery`
  - writes the derived compatibility manifest `deployments/31337.json`
  - syncs ABIs and the derived mobile deployment JSON
- `deploy-email-local`
  - deploys or reuses zk-email infra:
    - `UserOverrideableDKIMRegistry`
    - `Verifier`
    - `Groth16Verifier`
    - `EmailAuth`
    - `EmailRecoveryCommandHandler`
  - deploys Trezo's custom `EmailRecovery`
  - appends the new addresses into the derived compatibility manifest `deployments/31337.json`
  - syncs updated artifacts into the mobile app

`DeployAccount.s.sol` is local-only and uses the legacy `0x4e59...` CREATE2 root. It is retained as a fixture for local development and tests.

## Canonical Portable/Release Flow
```bash
cd contracts
make deploy-sepolia
make deploy-email-sepolia
```

- `make deploy-sepolia` is a compatibility alias for the canonical `make deploy-infra-sepolia` flow.
- Sepolia is portable and must use `DeployInfra`, not `DeployAccount`.
- Canonical release artifacts live in `deployments/releases/*` and `deployments/chains/*`.
- `deployments/<chainId>.json` and the synced mobile JSON are derived outputs, not the source of truth.

For `DeployEmailRecovery.s.sol`, the key environment variables are:
- `KILL_SWITCH_AUTHORIZER`
- `DKIM_REGISTRY` or `DKIM_SIGNER`
- optional reuse of existing infra:
  - `VERIFIER`
  - `EMAIL_AUTH_IMPL`
  - `COMMAND_HANDLER`
- optional overrides:
  - `MINIMUM_DELAY`
  - `DKIM_DELAY`
  - `ZK_EMAIL_OWNER`

If `VERIFIER`, `DKIM_REGISTRY`, `EMAIL_AUTH_IMPL`, or `COMMAND_HANDLER` are omitted, the script deploys the missing pieces itself.

## Email Recovery Notes
- Trezo uses a **custom** `EmailRecovery` module, not zk-email's upstream `UniversalEmailRecoveryModule`.
- The repo deploys the onchain contracts only. The **email relayer / prover stack** is separate and not part of this Foundry project.
- Recovery execution still depends on the account explicitly trusting the module as a recovery executor.
- The current milestone is to make email recovery work end-to-end onchain and in the mobile install flow while keeping the AA integration reusable for future wallet orchestration work.

## Email Recovery Boundary
- **Contracts in this repo**
  - deploy or reuse zk-email infra
  - deploy Trezo's `EmailRecovery` module
  - expose the onchain entrypoints used by recovery
- **Mobile app**
  - prepares guardian configuration
  - installs the module on the smart account
  - displays status and diagnostics
- **External relayer / prover**
  - owns email intake, proof generation, and transaction submission for
    - `handleAcceptance(...)`
    - `handleRecovery(...)`
    - delayed `completeRecovery(...)`

## Useful Tests
```bash
cd contracts
forge test --match-contract EmailRecoveryTest -vv
forge test --match-contract ModuleManagerTest -vv
forge test --match-contract SocialRecoveryIntegrationTest -vv
```

## Notes
- Bundler integration targets EntryPoint v0.7.
- `DeployAccount.s.sol` preserves existing email-recovery fields in the derived compatibility manifest when the account stack is redeployed locally.
- `DeployEmailRecovery.s.sol` preserves the core deployment metadata and appends the zk-email deployment metadata.
