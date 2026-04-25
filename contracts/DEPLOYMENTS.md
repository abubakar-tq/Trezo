# Trezo Deterministic Deployments

Trezo now uses an initializer-bound deployment model.

## Infra Release

- Current release: `TREZO_INFRA_V2`
- Canonical root factory: `0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7`
- EntryPoint: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- Portable chains: Ethereum, Sepolia, Optimism, Base, Arbitrum, Polygon
- Non-portable for now: zkSync Era and zkSync Sepolia

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
forge script script/PredictInfra.s.sol:PredictInfra --rpc-url <rpc>
forge script script/DeployInfra.s.sol:DeployInfra --rpc-url <rpc> --broadcast
forge script script/VerifyInfra.s.sol:VerifyInfra --rpc-url <rpc>
forge script script/CheckChainSupport.s.sol:CheckChainSupport --rpc-url <rpc>
```

`DeployInfra` expects `PRIVATE_KEY`. `ENTRYPOINT` is the only optional override.

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

## Legacy Local/Test Flow

`DeployAccount.s.sol` remains a legacy local/test fixture rooted at `0x4e59...`.

```bash
make deploy-local
make deploy-email-local
```

- This flow is local-only and must not be used for Sepolia, mainnet, or any other non-local chain.
- `deployments/<chainId>.json` is a derived compatibility manifest for local/mobile workflows.
- The synced mobile JSON is derived output and must not be treated as the canonical release source of truth.

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
- Never use `DeployAccount.s.sol` for Sepolia, mainnet, or other non-local chains.
- Never change salts after a release is cut.
- Never reuse a salt for materially different bytecode.
- Add a chain to portable mode only after root factory, infra prediction, infra verification, and wallet prediction all pass.
- Keep user-specific recovery configuration outside the address formula.
