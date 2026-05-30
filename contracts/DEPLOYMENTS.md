# Trezo Deterministic Deployments

Trezo now uses an initializer-bound deployment model.

## Infra Release

- Current release: `TREZO_INFRA_V2`
- Canonical root factory: `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7`
- EntryPoint: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- Portable chains: Ethereum, Ethereum Sepolia, Optimism, Base, Base Sepolia (84532), Arbitrum, Polygon
  - Base Sepolia is the demo testnet and is portable: a wallet there shares its address with the same wallet on every other portable chain.
- Non-portable for now: zkSync Era and zkSync Sepolia (different CREATE2 derivation)
- Code source of truth: `apps/mobile/src/integration/chains.ts` `PORTABLE_CHAIN_IDS`

## Wallet Address Rules

- Portable salt: `keccak256(abi.encode("TREZO_WALLET_PORTABLE_V2", walletId, walletIndex, initializerHash))`
- Chain-specific salt: `keccak256(abi.encode("TREZO_WALLET_CHAIN_SPECIFIC_V2", chainId, walletId, walletIndex, initializerHash))`
- `initializerHash` is `keccak256(SmartAccount.initialize(entryPoint, validator, passkeyInit))`
- Deployment is permissionless. There is no backend deployment authorization step.
- Changing validator or passkey before first deployment on a new chain changes the future address on that chain.
- Same-address replay is still possible only by reusing the original deployment snapshot.

## Script Order

```bash
forge script script/CheckRootFactory.s.sol:CheckRootFactory --rpc-url <rpc>
forge script script/CheckSpokePool.s.sol:CheckSpokePool   --rpc-url <rpc>  # pre-flight before any chain that ships CrossChainExecutor
forge script script/PredictInfra.s.sol:PredictInfra       --rpc-url <rpc>
forge script script/DeployInfra.s.sol:DeployInfra         --rpc-url <rpc> --broadcast
forge script script/VerifyInfra.s.sol:VerifyInfra         --rpc-url <rpc>
forge script script/CheckChainSupport.s.sol:CheckChainSupport --rpc-url <rpc>
```

`DeployInfra` expects `PRIVATE_KEY`. `ENTRYPOINT` is the only optional override.

`DeployInfra` deploys six contracts in one shot through the Safe singleton factory: `SmartAccount`, `PasskeyValidator`, `SocialRecovery`, `MinimalProxyFactory`, `AccountFactory`, and `CrossChainExecutor`. The first five are bytecode-only deterministic; `CrossChainExecutor` takes `(spokePool, swapRouter)` from `script/common/AcrossConfig.sol`, so its predicted address only matches across chains that have the same Across V3 SpokePool + Uniswap V3 SwapRouter02 pinned there.

## Canonical Portable/Release Flow

Use this flow for every portable release chain, including Sepolia:

```bash
make check-root-factory RPC_URL=<rpc>
make predict-infra RPC_URL=<rpc> [ENTRYPOINT=...]
make deploy-infra RPC_URL=<rpc> PRIVATE_KEY=<pk> [ENTRYPOINT=...]
make verify-infra RPC_URL=<rpc> [ENTRYPOINT=...]
make predict-wallet RPC_URL=<rpc> ACCOUNT_FACTORY=<factory> ...
```

- `SAFE_SINGLETON_FACTORY` is the only canonical portable root.
- `deployments/releases/*` and `deployments/chains/*` are the canonical release artifacts.
- `make deploy-sepolia` is a compatibility alias for `make deploy-infra-sepolia`.

## Local Safe-Root Validation Flow

```bash
make deploy-local
```

- This flow is local-only and uses the same Safe-root deployer family as the release path.
- `DeployInfra.s.sol` is still the entrypoint; `make deploy-local` sets `DEPLOYMENT_NAMESPACE=local`.
- Local validation artifacts live under:
  - `deployments/local/releases/*`
  - `deployments/local/chains/*`
- `deployments/<chainId>.json` is a derived compatibility manifest for local/mobile workflows.
- The synced mobile JSON is derived output and must not be treated as the canonical release source of truth.
- `make deploy-email-local` remains available when you only need to refresh the email-recovery portion of the local stack.

## Wallet Prediction

Prediction now requires the full deployment snapshot:

```bash
make predict-wallet \
  RPC_URL=<rpc> \
  ACCOUNT_FACTORY=<factory> \
  WALLET_ID=<bytes32> \
  VALIDATOR=<validator> \
  PASSKEY_ID_RAW=<bytes32> \
  PASSKEY_PX=<uint256> \
  PASSKEY_PY=<uint256> \
  WALLET_INDEX=0
```

## Release Rules

- Never deploy portable infra outside the scripted Safe Singleton Factory path.
- Never introduce an alternate root deployer path for local or release infra.
- Never change salts after a release is cut.
- Never reuse a salt for materially different bytecode.
- Add a chain to portable mode only after root factory, infra prediction, infra verification, and wallet prediction all pass.
- Keep user-specific recovery configuration outside the address formula.
