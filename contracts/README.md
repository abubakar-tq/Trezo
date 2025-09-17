# Smart Contract Wallet — Contracts

This package contains the on-chain contracts powering our **EVM-compatible smart contract wallet** with **account abstraction (ERC-4337)**.  

It includes the core account, factory, recovery, session, and paymaster modules used by the wallet applications (mobile, web, extension).

## Features
- **ERC-4337 Smart Account** – upgradeable, deterministic deployment
- **Factory** – CREATE2 deployments for predictable addresses
- **Modules**  
  - Guardians (M-of-N social recovery)  
  - Session Keys (ephemeral, scoped permissions)  
  - Spending Limits (per-token caps, daily velocity)  
  - Upgrade control  
- **Paymaster** – sponsored transactions with policy verification
- **Interfaces** – ERC-1271 signatures, module APIs


## New Contracts (scaffold)
- `src/Account.sol`: Modular smart account (Erc 7579) implementing:
  - ERC-4337 `validateUserOp` (minimal) for EntryPoint integration
  - ERC-1271 `isValidSignature`
  - ERC-6492 stub via optional verifier hook (off-chain standard)
  - Module manager: install/uninstall modules, selector routing, module execution
- `src/AccountBeacon.sol`: Minimal `AccountBeacon` and `AccountBeaconProxy` for upgradeable accounts.
- `src/AccountFactory.sol`: Deterministic deployments using `CREATE2`, initializing owner/EntryPoint.
- `src/modules/ModuleBase.sol`: Lightweight base module demonstrating install/uninstall hooks.
- `src/modules/ExampleModule.sol`: Simple example module exposing `ping()`.

## Project Structure
```

contracts/
├─ src/
│  ├─ Account.sol
│  ├─ AccountBeacon.sol
│  ├─ AccountFactory.sol
│  └─ modules/
│     ├─ ModuleBase.sol
│     └─ ExampleModule.sol
├─ script/
├─ test/
└─ foundry.toml

````

## Development
Requires [Foundry](https://book.getfoundry.sh/).

```bash
# install
curl -L https://foundry.paradigm.xyz | bash
foundryup

# build & test
forge build
forge test -vv
````

## Notes
- For production, replace local interfaces with imports from
  `eth-infinitism/account-abstraction` and OpenZeppelin (Beacon/Proxy, ECDSA, Ownable).
- ERC-6492 is an off-chain standard. This scaffold includes a verifier hook
  to support wrapped signatures, but you should plug in a concrete verifier
  or adjust to your organization’s 6492 flavor.

## Deployment

Example (local anvil):

```bash
anvil &
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

## License

MIT

