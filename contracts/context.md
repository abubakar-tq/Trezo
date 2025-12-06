# Smart-Contract Wallet — Contracts Overview

> Context pack for coding assistants: ERC-4337 AA wallet with modular policies, multi-chain deployments, clones proxies, and cross-chain config sync using a manifest hash.


---

## Desing Patterns

Proxy & Account Pattern

For scalability and upgradeability, we adopt a minimal proxy setup combined with the ERC-7579 modular account standard:

 minimal proxies (EIP-1167)
Each user wallet is a lightweight clone pointing. This keeps per-wallet deployment gas low while ensuring centralized, auditable upgrade paths.

ERC-7579 modular account pattern:
The wallet core follows the ERC-7579 specification, which standardizes validators, executors, and hooks. This modular approach enables features like passkey/2FA authentication, guardian-based recovery, spending limits, DEX integrations, and cross-chain execution to be installed/uninstalled as modules instead of baking them into the core.

ERC-4337 compatibility:
All accounts expose validateUserOp and integrate with bundlers/paymasters, ensuring smooth operation in today’s account abstraction infrastructure. ERC-7579 modules compose cleanly on top of ERC-4337, making the design future-proof toward EIP-7702.

---



## 0. Glossary

* **Account**: User’s smart account (AA) contract implementing 4337 interfaces.
* **Module**: Plug-in that adds validation, execution hooks, or policies (e.g., guardians, limits, 2FA, session keys).
* **Manifest**: Off-chain JSON/struct describing active modules + parameters.
* **Manifest Hash**: Keccak256 of the canonical manifest stored on-chain (`bytes32`).
* **Factory**: Deploys accounts (CREATE2) as minimal proxies pointing to a template.
* **Clone (EIP-1167)**: Minimal proxy used per-user/per-chain to keep deployments cheap.

---

## 1. Topology (per chain)

```
AccountFactory ──deploys──▶ AccountProxy (EIP-1167 clone) ──delegatecall──▶ AccountImplementation (AccountVx)
                                         ▲
                                         │
                                        ──▶ current AccountImplementation
```

* **One Factory ***
* **Many proxies (one per user per chain).**


---

## 2. Core Contracts

### 2.1 `AccountFactory`

* Deterministic deployments via `CREATE2` (counterfactual addresses).
* Accepts init params (owner keys, module set, thresholds, limits, etc.).
* Emits `WalletDeployed(userId, chainId, wallet, manifestHash, version)`.

**Key functions**

```solidity
function getCounterfactualAddress(
    bytes32 salt,
    bytes calldata initData
) external view returns (address);

function deployAccount(
    bytes32 salt,
    bytes calldata initData
) external returns (address wallet);
```



### 2.3 `AccountProxy` (EIP-1167 clone)

* Minimal proxy that delegates to `implementation()`.
* **Storage lives here** (modules, guardians, limits, manifest fields, etc.).

### 2.4 `AccountVx` (Implementation)

Implements AA + modular hooks.

* 4337 entrypoints: `validateUserOp`, `execution()`.
* Module management: `installModule`, `uninstallModule`, `setParam`.
* Config tracking: `manifestHash`, `manifestVersion` stored in proxy storage.

**Essential storage (append-only layout)**

```solidity
bytes32  manifestHash;      // keccak256(manifestJSON)
uint256  manifestVersion;   // monotonically increasing
address  owner;             // or owner key manager
mapping(address => bool) isGuardian;
uint256  guardianThreshold;
// module bitmap / registry pointers
mapping(bytes32 => bool)    moduleEnabled; // keyed by moduleId
// example policy storage
mapping(address => uint256) dailyLimit;    // per token
uint256  lastLimitReset;                   // unix day
```

**Interfaces**

```solidity
interface IAccount is IERC165 {
  function validateUserOp(UserOperation calldata, bytes32 userOpHash, uint256 missingAccountFunds)
    external returns (uint256 validationData);
}

interface IModule {
  function onInstall(bytes calldata data) external;   // only account
  function onUninstall(bytes calldata data) external; // only account
  function validateUserOp(bytes calldata ctx) external returns (bool ok, bytes4 reason);
}
```

---

## 3. Modules (Examples)

Each module is a contract with a stable ID (`bytes32 moduleId`) and optional storage slots (via delegatecall or via account-owned storage).

* **GuardianManager**: manages guardian set + M-of-N threshold; exposes `rotateOwner()` gated by guardian approvals.
* **SpendingLimit**: rolling window caps per token; enforced in `preExecute()`.
* **TwoFAHook**: adds an extra challenge (TOTP / webauthn proof) in `validateUserOp`.
* **SessionKeyManager**: ephemeral keys with scopes (selectors, destinations, value), TTL.
* **Allowlist/Denylist**: restrict targets and function selectors.

**Module API (canonical pattern)**

```solidity
function moduleId() external pure returns (bytes32);
function moduleVersion() external pure returns (uint64);

// called by AccountVx
function preValidate(bytes calldata ctx) external returns (bool);
function postValidate(bytes calldata ctx) external;
function preExecute(bytes calldata call) external returns (bool);
function postExecute(bytes calldata call, bool success) external;
```

---

## 4. Manifest + Hash

* **Manifest (off-chain JSON)** is the canonical description of active modules + parameters (owners, guardians, limits, etc.).
* **`manifestHash`** (`bytes32`) and **`manifestVersion`** are stored **in the proxy** for:

  * Cross-chain sync checks (wallets for the same user should share the same hash/version).
  * Verifiable UI (display JSON only if its hash matches on-chain).

**Update flow**

1. Apply config change on-chain (e.g., `setGuardians`).
2. Rebuild manifest JSON, compute new keccak256.
3. Update `manifestHash` and increment `manifestVersion` via `setManifest(bytes32 newHash, uint256 newVersion)`.
4. Repeat on all chains. UI compares versions and flags drift.

---

## 5. Cross-Chain Sync

Two incremental strategies:

**A) Orchestrated Push (v1)**

* Backend queues the same config txs on each chain.
* Verifies hash/version convergence.

**B) Canonical Registry + Messaging (v2)**

* A `PolicyRegistry` on a home chain stores the canonical manifest hash.
* Changes are broadcast via messaging (LayerZero/Wormhole/CCIP) to remote chains.
* Remote wallets update local storage upon verified messages.

**Events**

```solidity
event PolicyUpdated(address indexed wallet, bytes32 manifestHash, uint256 version);
event ModuleChanged(address indexed wallet, bytes32 moduleId, bool enabled);
```

---

## 6. Upgradeability & Governance


* **Per-wallet state**: lives in proxies; safe across upgrades (append-only storage layout).
* **Migrations**: new implementation exposes `migrate()` guarded by `manifestVersion` expectations.
* **Kill Switches**: module-level pausables to isolate risk without freezing all functionality.

---

## 7. Security Invariants

* All sensitive ops (owner rotation, module install/uninstall, limit edits) **must route through validation hooks** used by 4337 (`validateUserOp`).
* Enforce **manifestVersion** on state writes (`require(expectedVersion == manifestVersion)`), making retries idempotent and preventing stale updates.
* Never reorder/remove storage; **append only**.
* Emit events for all policy mutations; index in backend.

---

## 8. Testing Matrix (high level)

* **Unit**: module enable/disable, guardian threshold math, rate limits, session key scopes.
* **4337**: `validateUserOp` reverts/accepts under all policy combinations.
* **Upgrade**: storage layout compatibility; migration scripts.
* **Cross-chain**: drift detection (hash mismatch), resync flows, partial failure retries.

---

## 9. Deployment Checklist

* Deploy `AccountImplementation (AccountV1)`.
* Deploy `ProxyFactory` pointing to `AccountV1`.
* Deploy `AccountFactory` with proxyFactory address.
* Register initial modules in `ModuleRegistry` (if used).
* Configure multisig + timelock over admin roles.

---

## 10. Interfaces (snippets)

```solidity
// Account config
function setManifest(bytes32 newHash, uint256 newVersion) external onlyAccount;
function manifest() external view returns (bytes32 hash, uint256 version);

// Guardians
function setGuardians(address[] calldata add, address[] calldata remove, uint256 threshold,
                      bytes32 expectedManifestHash, uint256 expectedVersion) external;

// Modules
function installModule(bytes32 moduleId, bytes calldata init,
                       bytes32 expectedManifestHash, uint256 expectedVersion) external;
function uninstallModule(bytes32 moduleId,
                         bytes32 expectedManifestHash, uint256 expectedVersion) external;

// Limits (example)
function setDailyLimit(address token, uint256 amount,
                       bytes32 expectedManifestHash, uint256 expectedVersion) external;
```

---

## 11. Addresses (fill per env)

```
# mainnet / testnets
AccountImplementation:  <to-fill>
ProxyFactory            <to-fill>
AccountFactory:         <to-fill>
ModuleRegistry:         <to-fill>
EntryPoint (4337):      <chain-specific>
Paymaster (optional):   <to-fill>
```

---

## 12. Notes for Coding Models

* Treat `manifestHash` + `manifestVersion` as **must-update** fields on every config mutation.
* Prefer **library functions** for manifest hashing to avoid drift; define canonical JSON/ABI encoding order.
* Keep module interfaces cohesive; avoid reentrancy by design; consider `Checks-Effects-Interactions` + reentrancy guards where needed.
* Gas: EIP-1167 clones for per-user wallets; module calls should be tight and revert early.


