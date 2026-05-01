# Level 3 - ZK Email Guardian Recovery

Implementation-ready plan for Trezo Level 3 recovery. This plan is written so a small model can implement one phase at a time without redesigning the system.

## 0. Non-Negotiable Architecture

Use one user-facing multichain recovery intent and many per-chain proof/execution records.

```text
Guardian approves once at the product layer:
  "Recover Trezo wallet 0xACCOUNT with this new passkey across chains [A, B, C] before deadline D."

Each chain receives its own proof submission and execution:
  chain A: verify proof/threshold/timelock, verify chain A is in the approved scope, add passkey
  chain B: verify proof/threshold/timelock, verify chain B is in the approved scope, add passkey
  chain C: verify proof/threshold/timelock, verify chain C is in the approved scope, add passkey
```

Rules:

- Recovery preserves the same smart-account address.
- Backend and Supabase are UX/status metadata only.
- Valid zk-email proofs and on-chain state are the authority.
- No `onlyBackend`, no `onlyRelayer`, no trusted recovery submitter.
- Do not build custom ZK circuits.
- Prefer ZK Email's generic account-recovery template.
- Do not mark a chain recovered until a receipt is confirmed and the new passkey is visible on-chain.

## 1. Indexed Codebase Findings

The repo should be explored with `graphify-out/GRAPH_REPORT.md`, `plan.md`, semantic search, and the focused files below before coding.

Existing pieces to reuse:

| Area | File | Current state |
|---|---|---|
| Account recovery executor trust | `contracts/src/account/SmartAccount.sol` | `addPasskeyFromRecovery(...)` already gates recovery modules |
| Passkey install target | `contracts/src/modules/passkey/PasskeyValidator.sol` | Multiple passkeys already supported |
| Shared recovery hash direction | `contracts/src/recovery/RecoveryTypes.sol` and `RecoveryHash.sol` | Level 2 already has chain scope, nonce, deadline, guardian set hash, policy hash concepts |
| On-chain guardian baseline | `contracts/src/modules/SocialRecovery/SocialRecovery.sol` | Verifies sorted chain scopes, local chain membership, nonce, guardian set hash, policy hash, deadline |
| Email recovery module | `contracts/src/modules/EmailRecovery/EmailRecovery.sol` | Decodes `PasskeyInit`, calls `addPasskeyFromRecovery`, exposes `recoveryDataHash(PasskeyInit)` |
| Email recovery interface | `contracts/src/modules/EmailRecovery/interfaces/IEmailRecovery.sol` | Only legacy passkey-only helper exists |
| Deploy script | `contracts/script/DeployEmailRecovery.s.sol` | Deploys/reuses verifier, DKIM registry, EmailAuth implementation, command handler, module |
| Mobile install flow | `apps/mobile/src/features/wallet/services/EmailRecoveryService.ts` | Derives guardian EmailAuth addresses, installs module, persists setup metadata |
| Mobile setup UI | `apps/mobile/src/features/profile/screens/EmailRecoveryScreen.tsx` | Email recovery configuration/install screen exists |
| Email setup tables | `apps/backend/supabase/migrations/20241009000000_init_schema_consolidated.sql` | `email_recovery_configs`, `email_recovery_guardians`, `email_recovery_chain_installs` exist |
| Level 2 request tables | `apps/backend/supabase/migrations/20260427000000_recovery_tables.sql` | Good model for group request, approvals, per-chain status |

Current contract facts:

- `EmailRecovery.recoveryDataHash(PasskeyInit)` returns `keccak256(abi.encode(newPasskey))`.
- `EmailRecovery.recover(account, recoveryData)` expects `abi.encode(PasskeyInit)` only.
- `SocialRecovery` already validates a local chain scope against `block.chainid`, module address, wallet address, nonce, guardian set hash, and policy hash.
- `RecoveryTypes.ChainRecoveryScope` currently names the module field `socialRecovery`; Level 3 should generalize it to `recoveryModule` or add a new generic scope type before EmailRecovery uses it.

## 2. Web Research Decisions For ZK Email Generic Template

Use the generic account-recovery command handler first.

Confirmed from ZK Email docs:

- `EmailRecoveryManager` is the central account-recovery orchestrator.
- `EmailRecoveryCommandHandler` is the universal handler for validator/account recovery.
- Acceptance command template: `Accept guardian request for {ethAddr}`.
- Recovery command template: `Recover account {ethAddr} using recovery hash {string}`.
- The `{string}` matcher can carry our `0x` multichain recovery hash.
- The command handler exposes `parseRecoveryDataHash(...)`, so the approved hash can remain generic.
- The Account Recovery Relayer API has `acceptanceRequest`, `recoveryRequest`, `requestStatus`, `completeRequest`, and `getAccountSalt` endpoints.
- The public staging base shown in docs is `https://auth-base-sepolia-staging.prove.email/api`.

Resolved answer for the previous Question 2:

```text
Relayer API model:
  POST /acceptanceRequest
  POST /recoveryRequest
  POST /requestStatus
  POST /completeRequest
  POST /getAccountSalt

Required fields for recoveryRequest:
  controller_eth_addr
  guardian_email_addr
  template_idx
  command

Command to send:
  Recover account 0xACCOUNT using recovery hash 0xMULTICHAIN_RECOVERY_DATA_HASH

Authentication:
  Public docs do not show a required auth header for the staging API.
  Implement adapter with optional API-key support anyway:
    Authorization: Bearer ${ZK_EMAIL_RELAYER_API_KEY}
  If no key is configured, send unauthenticated requests.
```

Template decision:

```text
Preferred:
  Use existing EmailRecoveryCommandHandler template index for:
  Recover account {ethAddr} using recovery hash {string}

Fallback:
  If deployed command handler is incompatible, deploy/reuse AccountHidingRecoveryCommandHandler or a tiny command handler variant.

Avoid:
  Custom ZK circuit.
  Template that lists every chain in natural language as proof authority.
  Template that approves a backend request ID instead of the on-chain hash.
```

## 3. Multiple-Chain Proof Policy

We must send/submit proofs on multiple chains. Model this explicitly from day one.

Human approval meaning:

```text
One guardian approval is for one group-level multichainRecoveryDataHash.
```

On-chain proof submission meaning:

```text
Each chain needs its own proof submission or recovery transaction lifecycle.
```

Implementation rule:

- Create one `email_recovery_approvals` row per guardian per group.
- Create one `email_recovery_chain_approval_submissions` row per guardian per chain.
- Store the same `multichain_recovery_data_hash` on every chain submission.
- If the relayer returns a reusable `EmailAuthMsg`, submit the same proof bytes to each chain and store separate tx hashes.
- If the relayer binds a request/proof to `controller_eth_addr`, chain, EmailAuth instance, or nullifier domain, call `recoveryRequest` once per guardian per chain with the exact same command text and hash.
- The UI still shows one recovery request; it can show per-chain proof submission progress under that request.

Do not assume proof reuse is safe until tested against two deployed chains. The data model must work whether reuse is possible or not.

## 4. Chosen On-Chain Nonce Strategy

Best option: add an EmailRecovery module nonce per account and bind it inside each chain scope.

```solidity
mapping(address account => uint256 nonce) private _emailRecoveryNonces;

function getRecoveryNonce(address account) external view returns (uint256) {
    return _emailRecoveryNonces[account];
}
```

How it works:

- Each chain has its own local `EmailRecovery` module storage.
- Group creation reads `getRecoveryNonce(account)` from every target chain.
- The multichain intent includes a sorted `ChainRecoveryScope[]` where each scope contains the chain's local nonce.
- `recover(...)` finds the local scope for `block.chainid` and requires `scope.nonce == _emailRecoveryNonces[account]`.
- After successful passkey installation on that chain, increment `_emailRecoveryNonces[account] += 1`.
- A stale proof cannot be reused on the same chain after execution because the nonce changed.
- A proof for chain set `[A, B]` cannot execute on chain C because chain C has no matching local scope.

Rejected alternatives:

| Option | Decision | Reason |
|---|---|---|
| Backend-managed sequential nonce | Reject for authority | Backend cannot be replay authority |
| Timestamp/random nonce only | Demo-only fallback | Contract cannot know it was unused without on-chain storage |
| Use `EmailRecoveryManager.recoveryRequests[account]` fields | Do not rely on as sole nonce | It tracks active recovery flow, not a clean monotonic intent nonce across completed attempts |
| Global cross-chain nonce | Reject for MVP | Requires cross-chain state sync and breaks per-chain retry/failure isolation |
| Per-chain local nonce in scope | Choose | Simple, on-chain, compatible with multichain execution and partial retry |

Important nuance:

```text
One multichain intent can still have per-chain nonce values.
The guardian approves one hash over the full sorted scope set.
Each chain verifies only its own scope plus the shared intent hash.
```

## 5. Target Hash And Payload Model

Use shared recovery-core helpers. Do not duplicate hash logic in EmailRecovery, mobile, and backend.

Update `RecoveryTypes.sol` to generic names if Level 2 has not shipped. If renaming is too invasive, add V2 structs and leave old Level 2 names as compatibility aliases.

Target Solidity structs:

```solidity
library RecoveryTypes {
    struct ChainRecoveryScope {
        uint256 chainId;
        address wallet;
        address recoveryModule;
        uint256 nonce;
        bytes32 guardianSetHash;
        bytes32 policyHash;
    }

    struct RecoveryIntent {
        bytes32 requestId;
        bytes32 newPasskeyHash;
        bytes32 chainScopeHash;
        uint48 validAfter;
        uint48 deadline;
        bytes32 metadataHash;
    }

    struct EmailRecoveryData {
        uint8 version;
        PasskeyTypes.PasskeyInit newPasskey;
        RecoveryIntent intent;
        ChainRecoveryScope[] scopes;
    }
}
```

Hash rules:

```text
newPasskeyHash = RecoveryHash.hashPasskeyInit(newPasskey)
chainScopeHash = RecoveryHash.hashChainScopes(sortedScopes)
intentHash = RecoveryHash.hashRecoveryIntent(intent)
recoveryData = abi.encode(version, newPasskey, intent, sortedScopes)
multichainRecoveryDataHash = keccak256(recoveryData)
```

Why `keccak256(recoveryData)` is used for the email-approved hash:

- The current zk-email recovery manager flow approves a `recoveryDataHash` and later completes with `recoveryData`.
- Existing Trezo `EmailRecovery.recoveryDataHash(PasskeyInit)` already follows `keccak256(abi.encode(payload))`.
- Keeping this shape minimizes contract changes.
- The payload itself contains the typed shared `RecoveryIntent` and `ChainRecoveryScope[]`, so the hash remains strongly bound.

Canonical scope rules:

- `scopes.length > 0`.
- `scopes` sorted by ascending `chainId`.
- duplicate `chainId` rejected.
- each `scope.wallet` equals the recovered smart account for that chain.
- each `scope.recoveryModule` equals the local `EmailRecovery` address for that chain.
- each `scope.guardianSetHash` equals the local installed email guardian set hash.
- each `scope.policyHash` equals the local threshold/delay/expiry/handler policy hash.
- `intent.deadline >= block.timestamp`.
- `intent.validAfter == 0` for MVP unless implementing delayed start semantics.

## 6. Phase 0 - Assumption Validation Spike

Goal: verify exact contract/library behavior before editing production code.

Use semantic/indexed exploration first:

```bash
graphify query "How does EmailRecoveryManager bind recoveryDataHash to completeRecovery and command handler parseRecoveryDataHash?" --budget 2000
graphify query "How does SocialRecovery validate chain scope nonce guardian set hash and policy hash?" --budget 2000
```

Then inspect only these files:

```text
contracts/src/modules/EmailRecovery/EmailRecovery.sol
contracts/src/modules/EmailRecovery/interfaces/IEmailRecovery.sol
contracts/src/recovery/RecoveryTypes.sol
contracts/src/recovery/RecoveryHash.sol
contracts/src/modules/SocialRecovery/SocialRecovery.sol
contracts/test/modules/EmailRecovery.t.sol
contracts/test/integration/EmailRecoveryIntegration.t.sol
contracts/script/DeployEmailRecovery.s.sol
```

Answer in a short implementation note before Phase 1 coding:

- Exact `EmailRecoveryManager.completeRecovery(...)` hash check.
- Exact `handleRecovery(...)` function signature used by tests.
- Whether `commandHandler` already deployed by `DeployEmailRecovery.s.sol` is universal `EmailRecoveryCommandHandler`.
- Whether `EmailRecoveryManager` exposes enough guardian data to compute guardian set hash after install.
- Whether `EmailAuthMsg` from a relayer response can be manually submitted to more than one chain in local/testnet.

Acceptance:

- A note is appended to this file under `Implementation Notes` with confirmed function names.
- No code behavior changed in this phase.

## 7. Phase 1 - Shared Recovery Core

Goal: make SocialRecovery and EmailRecovery use one shared intent/scope hashing model.

Files:

```text
contracts/src/recovery/RecoveryTypes.sol
contracts/src/recovery/RecoveryHash.sol
contracts/test/recovery/RecoveryHash.t.sol
apps/mobile/src/integration/viem/recoveryHash.ts
apps/mobile/src/integration/viem/__tests__/recoveryHash.test.ts
```

Solidity work:

- Rename `ChainRecoveryScope.socialRecovery` to `recoveryModule` if feasible.
- If rename is too risky, add `EmailChainRecoveryScope` and shared hash helpers, then create a follow-up cleanup card.
- Add `hashEmailRecoveryData(...)` helper if Solidity can express it cleanly.
- Keep `hashPasskeyInit(...)`, `hashChainScopes(...)`, and `hashRecoveryIntent(...)` as the source of truth.
- Add explicit sorted-scope validation helper only if both modules use it.

TypeScript work:

- Implement `normalizeChainScopes(scopes)`.
- Implement `assertSortedUniqueChainScopes(scopes)`.
- Implement `hashPasskeyInit(passkey)` to match Solidity typehash-based hash.
- Implement `hashChainScope(scope)`.
- Implement `hashChainScopes(scopes)`.
- Implement `hashRecoveryIntent(intent)`.
- Implement `encodeEmailRecoveryData({ version, newPasskey, intent, scopes })`.
- Implement `hashEmailRecoveryData(data)` as `keccak256(encodeEmailRecoveryData(data))`.

Tests:

- Same scopes in different input order produce same final hash after normalization.
- Duplicate chain IDs are rejected.
- Different chain set changes hash.
- Different per-chain nonce changes hash.
- Different recovery module changes hash.
- Different guardian set hash changes hash.
- Different policy hash changes hash.
- Different deadline changes hash.
- Different new passkey changes hash.
- Solidity and TypeScript test vectors match.

Verification:

```bash
cd contracts
forge test --match-contract RecoveryHashTest -vv
cd ../apps/mobile
npm test -- recoveryHash
```

## 8. Phase 2 - EmailRecovery Contract Multichain Support

Goal: EmailRecovery can complete a multichain-approved recovery payload on each included chain.

Files:

```text
contracts/src/modules/EmailRecovery/EmailRecovery.sol
contracts/src/modules/EmailRecovery/interfaces/IEmailRecovery.sol
contracts/test/modules/EmailRecovery.t.sol
contracts/test/integration/EmailRecoveryIntegration.t.sol
```

Add storage:

```solidity
mapping(address account => uint256 nonce) private _emailRecoveryNonces;
mapping(address account => bytes32 guardianSetHash) private _emailGuardianSetHashes;
mapping(address account => bytes32 policyHash) private _emailPolicyHashes;
```

Add getters:

```solidity
function getRecoveryNonce(address account) external view returns (uint256);
function getGuardianSetHash(address account) external view returns (bytes32);
function getPolicyHash(address account) external view returns (bytes32);
function multichainRecoveryDataHash(bytes calldata recoveryData) external pure returns (bytes32);
```

Update `onInstall(...)`:

- Decode existing `(guardians, weights, threshold, delay, expiry)` exactly as today.
- Call `configureRecovery(...)` exactly as today.
- Store `_emailGuardianSetHashes[msg.sender] = keccak256(abi.encode(guardians, weights))`.
- Store `_emailPolicyHashes[msg.sender] = keccak256(abi.encode(threshold, delay, expiry, commandHandler, address(this), uint256(1)))`.
- Do not store raw emails on-chain; guardians are EmailAuth addresses.

Update `recover(account, recoveryData)`:

```text
If recoveryData.length == 96:
  decode as legacy PasskeyInit.
  keep existing behavior for backwards compatibility.

If recoveryData.length != 96:
  decode as EmailRecoveryData V1.
  require version == 1.
  require intent.deadline >= block.timestamp.
  require intent.newPasskeyHash == RecoveryHash.hashPasskeyInit(newPasskey).
  require intent.chainScopeHash == RecoveryHash.hashChainScopes(scopes).
  require scopes are sorted and unique.
  find local scope where scope.chainId == block.chainid.
  require local scope exists.
  require local scope.wallet == account.
  require local scope.recoveryModule == address(this).
  require local scope.nonce == _emailRecoveryNonces[account].
  require local scope.guardianSetHash == _emailGuardianSetHashes[account].
  require local scope.policyHash == _emailPolicyHashes[account].
  validate passkey is non-zero.
  call addPasskeyFromRecovery(newPasskey).
  increment _emailRecoveryNonces[account].
  emit RecoveryExecuted(account, newPasskey.idRaw).
```

Important implementation detail:

- Branch only on the exact legacy static payload size: `abi.encode(PasskeyInit)` is 96 bytes.
- Do not use fuzzy checks like `recoveryData.length > ...` because ABI dynamic arrays make those fragile.
- Multichain payload must start with `uint8 version` and reject every version except `1`.
- If Solidity cannot safely decode the V1 dynamic payload in `recover(...)`, add a small internal decoder helper and cover malformed payloads in tests.

Tests:

- Legacy passkey-only recovery still passes.
- Multichain hash differs from legacy hash.
- Multichain recovery succeeds on an included chain.
- Multichain recovery rejects a chain not in scope.
- Multichain recovery rejects unsorted or duplicate scopes.
- Multichain recovery rejects wrong local nonce.
- Multichain recovery rejects wrong guardian set hash.
- Multichain recovery rejects wrong policy hash.
- Multichain recovery rejects expired intent.
- Successful recovery increments nonce.
- Reusing the same proof/payload on the same chain after success fails due to nonce.

Verification:

```bash
cd contracts
forge test --match-contract EmailRecoveryTest -vv
forge test --match-contract EmailRecoveryIntegrationTest -vv
```

## 9. Phase 3 - Supabase Schema

Goal: store one group-level intent and per-chain proof/execution children.

Migration file:

```text
apps/backend/supabase/migrations/20260501000000_email_recovery_multichain_groups.sql
```

Create `email_recovery_groups`:

```sql
CREATE TABLE IF NOT EXISTS public.email_recovery_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aa_wallet_id UUID REFERENCES public.aa_wallets(id) ON DELETE SET NULL,
  config_id UUID NOT NULL REFERENCES public.email_recovery_configs(id) ON DELETE CASCADE,
  smart_account_address TEXT NOT NULL,
  wallet_index INTEGER,
  chain_ids INTEGER[] NOT NULL,
  chain_scope_hash TEXT NOT NULL,
  recovery_intent_hash TEXT NOT NULL,
  multichain_recovery_data_hash TEXT NOT NULL,
  new_passkey_hash TEXT NOT NULL,
  new_passkey_id_raw_hash TEXT NOT NULL,
  new_passkey_pubkey_x TEXT NOT NULL,
  new_passkey_pubkey_y TEXT NOT NULL,
  new_passkey_json JSONB NOT NULL,
  recovery_data TEXT NOT NULL,
  valid_after TIMESTAMPTZ,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sending_approvals','collecting_approvals','threshold_reached','proofs_submitting','ready_to_execute','executing','partially_executed','executed','expired','cancelled','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_error TEXT
);
```

Create `email_recovery_chain_requests`:

```sql
CREATE TABLE IF NOT EXISTS public.email_recovery_chain_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.email_recovery_groups(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  smart_account_address TEXT NOT NULL,
  email_recovery_module TEXT NOT NULL,
  email_recovery_manager TEXT,
  command_handler TEXT,
  nonce_at_creation BIGINT NOT NULL,
  guardian_set_hash TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','proofs_pending','proofs_submitted','threshold_reached','timelock_pending','ready_to_execute','executing','executed','failed','cancelled')),
  timelock_ends_at TIMESTAMPTZ,
  schedule_tx_hash TEXT,
  execute_tx_hash TEXT,
  executed_block_number BIGINT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  CONSTRAINT email_recovery_chain_requests_unique UNIQUE (group_id, chain_id)
);
```

Create `email_recovery_approvals`:

```sql
CREATE TABLE IF NOT EXISTS public.email_recovery_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.email_recovery_groups(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES public.email_recovery_guardians(id) ON DELETE SET NULL,
  guardian_email_hash TEXT NOT NULL,
  masked_email TEXT,
  relayer_request_id TEXT,
  email_nullifier TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','email_sent','guardian_replied','proof_generated','submitted_to_chains','confirmed','failed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  CONSTRAINT email_recovery_approvals_unique UNIQUE (group_id, guardian_email_hash)
);
```

Create `email_recovery_chain_approval_submissions`:

```sql
CREATE TABLE IF NOT EXISTS public.email_recovery_chain_approval_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES public.email_recovery_approvals(id) ON DELETE CASCADE,
  chain_request_id UUID NOT NULL REFERENCES public.email_recovery_chain_requests(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  relayer_request_id TEXT,
  email_auth_msg_json JSONB,
  proof_hash TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','request_sent','proof_ready','submitting','submitted','confirmed','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  CONSTRAINT email_recovery_chain_approval_submissions_unique UNIQUE (approval_id, chain_request_id)
);
```

RLS:

- Users can select/insert/update/delete their own groups by `user_id`.
- Users can select/insert/update chain requests through owned group.
- Users can select/insert/update approvals through owned group.
- Users can select/insert/update chain approval submissions through owned group.
- Do not allow public writes from guardian links unless an Edge Function validates the link and only writes UX metadata.

Indexes:

- group by `user_id`, `smart_account_address`, `status`.
- chain requests by `group_id`, `chain_id`, `status`.
- approvals by `group_id`, `status`, `email_nullifier`.
- submissions by `chain_request_id`, `status`.

Verification:

```bash
cd apps/backend
npx supabase db push
```

## 10. Phase 4 - Client Services And Relayer Adapter

Goal: build the vertical slice with a mock relayer first, while keeping the real relayer adapter API-compatible.

Files:

```text
apps/mobile/src/features/wallet/services/EmailRecoveryGroupService.ts
apps/mobile/src/features/wallet/services/ZkEmailRelayerAdapter.ts
apps/mobile/src/features/wallet/services/MockZkEmailRelayer.ts
apps/mobile/src/features/wallet/services/ZkEmailGenericRelayer.ts
apps/mobile/src/integration/viem/recoveryHash.ts
apps/mobile/src/integration/viem/userOps.ts
```

`ZkEmailRelayerAdapter` interface:

```typescript
export interface ZkEmailRelayerAdapter {
  sendAcceptanceRequest(params: AcceptanceRequestParams): Promise<RelayerRequestRef>;
  sendRecoveryRequest(params: RecoveryEmailRequestParams): Promise<RelayerRequestRef>;
  getRequestStatus(requestId: string | number): Promise<RelayerRequestStatus>;
  submitProofToChain(params: SubmitProofToChainParams): Promise<ChainSubmissionResult>;
  completeRecovery(params: CompleteRecoveryRequestParams): Promise<CompleteRecoveryResult>;
}
```

`ZkEmailGenericRelayer` endpoints:

```text
GET  /echo
POST /acceptanceRequest
POST /recoveryRequest
POST /requestStatus
POST /completeRequest
POST /getAccountSalt
```

`EmailRecoveryGroupService.createGroup(...)` must:

- Resolve installed email recovery config.
- Default target chains to chains with `email_recovery_chain_installs.install_status = installed`.
- Read `getRecoveryNonce`, `getGuardianSetHash`, and `getPolicyHash` from each target chain.
- Build sorted chain scopes.
- Build `RecoveryIntent`.
- Encode `EmailRecoveryData`.
- Compute `multichainRecoveryDataHash`.
- Insert one `email_recovery_groups` row.
- Insert N `email_recovery_chain_requests` rows.
- Insert M `email_recovery_approvals` rows for guardians.

`sendApprovals(groupId)` must:

- Load group, guardians, and chain requests.
- For each guardian, send the generic command:

```text
Recover account 0xACCOUNT using recovery hash 0xMULTICHAIN_RECOVERY_DATA_HASH
```

- If configured `proof_mode = reusable`, create one relayer request per guardian and later submit proof to every chain.
- If configured `proof_mode = per_chain`, create one relayer request per guardian per chain and store it in `email_recovery_chain_approval_submissions`.

`executeReadyChains(groupId)` must:

- Query chain requests in `ready_to_execute`.
- Call the current zk-email manager completion entrypoint with `recoveryData`.
- Wait for receipt.
- Read the passkey validator state and confirm the new passkey exists.
- Mark each chain `executed` only after confirmation.
- Mark group `partially_executed` if at least one chain executed and at least one is pending/failed.
- Mark group `executed` only when every chain is executed.

Mock relayer behavior:

- `sendRecoveryRequest` returns deterministic fake request IDs.
- `getRequestStatus` transitions `Pending -> EmailReceived -> ProofGenerated` after a short delay.
- `submitProofToChain` records fake or local tx hashes depending on local contract test mode.
- It must still create per-chain submission rows so UI and executor paths match real mode.

Verification:

```bash
cd apps/mobile
npm run lint
npm test -- EmailRecoveryGroupService
```

## 11. Phase 5 - Mobile UX

Goal: show one recovery request with group-level approval and per-chain execution state.

Files:

```text
apps/mobile/src/features/profile/screens/EmailRecoveryScreen.tsx
apps/mobile/src/features/profile/screens/EmailRecoveryStartScreen.tsx
apps/mobile/src/features/profile/screens/EmailRecoveryGroupStatusScreen.tsx
apps/mobile/src/types/navigation.ts
apps/mobile/src/app/navigation/RootNavigation.tsx
```

Start screen requirements:

- Create a new passkey locally.
- Show target chains defaulting to installed chains.
- Show deadline defaulting to 7 days.
- Show guardians and threshold from email recovery config.
- Create group through `EmailRecoveryGroupService.createGroup`.
- Send approvals through `sendApprovals`.
- Navigate to status screen.

Status screen requirements:

```text
Recovery Request
Hash: 0x...
Deadline: ...

Guardian approvals
2 of 3 confirmed

Proof submissions
Base Sepolia: 2/2 confirmed
Sepolia: 1/2 pending
Polygon: 2/2 confirmed

Chain execution
Base Sepolia: executed
Sepolia: waiting for proofs
Polygon: ready to execute
```

User actions:

- Refresh status.
- Resend pending guardian emails.
- Submit ready proofs again for a failed chain.
- Execute ready chains.
- Cancel local UX request if not executed. On-chain cancellation only exists if EmailRecoveryManager supports it; do not fake on-chain cancellation.

Success rule:

- Show recovered for a chain only after receipt and passkey verification.
- Show full recovery only after every selected chain is recovered.

## 12. Phase 6 - Real Relayer/Testnet Integration

Goal: replace mock relayer with ZK Email generic relayer on one testnet, then two testnets.

Configuration:

```text
ZK_EMAIL_RELAYER_URL=https://auth-base-sepolia-staging.prove.email/api
ZK_EMAIL_RELAYER_API_KEY=optional
ZK_EMAIL_ACCEPTANCE_TEMPLATE_IDX=<from command handler>
ZK_EMAIL_RECOVERY_TEMPLATE_IDX=<from command handler>
ZK_EMAIL_PROOF_MODE=reusable | per_chain
```

One-chain testnet checklist:

- Deploy/reuse zk-email infra with `DeployEmailRecovery.s.sol`.
- Install EmailRecovery module on a smart account.
- Send guardian acceptance request.
- Confirm guardian accepted on-chain.
- Create recovery group for one chain.
- Send recovery request through relayer.
- Poll `requestStatus` until proof/nullifier available.
- Submit proof/recovery through manager.
- Complete recovery after delay.
- Verify new passkey active.

Two-chain testnet checklist:

- Use the same smart-account address if portable deployment is available.
- Create group with two chain scopes.
- Send the same recovery command hash for both chains.
- Test `proof_mode = reusable` first.
- If reusable fails due controller, EmailAuth, nullifier, or relayer request binding, switch to `proof_mode = per_chain`.
- Confirm both chains can execute independently.
- Confirm one chain failure does not block the other.

Verification:

```bash
cd contracts
make deploy-email-sepolia
cd ../apps/mobile
npm run lint
```

## 13. File Change Map

Phase 1 files:

```text
MODIFY contracts/src/recovery/RecoveryTypes.sol
MODIFY contracts/src/recovery/RecoveryHash.sol
ADD    contracts/test/recovery/RecoveryHash.t.sol
ADD    apps/mobile/src/integration/viem/recoveryHash.ts
ADD    apps/mobile/src/integration/viem/__tests__/recoveryHash.test.ts
```

Phase 2 files:

```text
MODIFY contracts/src/modules/EmailRecovery/EmailRecovery.sol
MODIFY contracts/src/modules/EmailRecovery/interfaces/IEmailRecovery.sol
MODIFY contracts/test/modules/EmailRecovery.t.sol
MODIFY contracts/test/integration/EmailRecoveryIntegration.t.sol
```

Phase 3 files:

```text
ADD apps/backend/supabase/migrations/20260501000000_email_recovery_multichain_groups.sql
```

Phase 4 files:

```text
ADD    apps/mobile/src/features/wallet/services/EmailRecoveryGroupService.ts
ADD    apps/mobile/src/features/wallet/services/ZkEmailRelayerAdapter.ts
ADD    apps/mobile/src/features/wallet/services/MockZkEmailRelayer.ts
ADD    apps/mobile/src/features/wallet/services/ZkEmailGenericRelayer.ts
MODIFY apps/mobile/src/integration/viem/userOps.ts only if needed for completion tx/UserOp submission
```

Phase 5 files:

```text
ADD    apps/mobile/src/features/profile/screens/EmailRecoveryStartScreen.tsx
ADD    apps/mobile/src/features/profile/screens/EmailRecoveryGroupStatusScreen.tsx
MODIFY apps/mobile/src/features/profile/screens/EmailRecoveryScreen.tsx
MODIFY apps/mobile/src/types/navigation.ts
MODIFY apps/mobile/src/app/navigation/RootNavigation.tsx
```

Do not touch unless a test proves it is required:

```text
contracts/src/account/SmartAccount.sol
contracts/src/modules/passkey/PasskeyValidator.sol
contracts/lib/**
custom zk-email circuits
```

## 14. Implementation Order For Fast Demo

Fastest workable demo path:

1. Phase 0 assumption validation.
2. Phase 1 shared hash helpers and test vectors.
3. Phase 2 EmailRecovery multichain payload support with local Foundry tests.
4. Phase 3 Supabase tables.
5. Phase 4 mock relayer and group service.
6. Phase 5 status UI with mock approvals.
7. Phase 6 real relayer only after mock vertical slice works.

Demo acceptance:

- User installs EmailRecovery module.
- Mock guardians are accepted.
- User creates a new passkey and starts a group recovery across two local/test chains.
- Guardian approval is represented by one group-level `multichainRecoveryDataHash`.
- Proof submission rows exist per guardian per chain.
- Each chain executes independently.
- New passkey works on every executed chain.
- Partial failure can be retried without creating a new group.

## 15. Implementation Notes

Append confirmed findings here during Phase 0 before code changes.

Initial assumptions to verify:

- `completeRecovery(account, recoveryData)` checks `keccak256(recoveryData)` against the approved hash.
- Universal `EmailRecoveryCommandHandler` is the deployed command handler from `DeployEmailRecovery.s.sol` unless env overrides it.
- Same `EmailAuthMsg` proof may or may not be reusable across chains; the schema supports both outcomes.
- EmailRecoveryManager active request state prevents parallel active recoveries per account, but EmailRecovery still needs its own monotonic nonce for replay protection after completion.

### V1 Architecture Correction (2026-05-01)

Confirmed findings from contract validation and architecture review:

1. **completeRecovery hash check**: `keccak256(recoveryData) != recoveryRequest.recoveryDataHash` — raw keccak of the entire calldata blob. This is exactly what our `multichainRecoveryDataHash = keccak256(abi.encode(version, newPasskey, intent, scopes))` produces.

2. **Command handler parsing**: Template `"Recover account {ethAddr} using recovery hash {string}"`. The `{string}` field is parsed via `StringUtils.hexToBytes32()` to get the `bytes32` hash that guardians vote on.

3. **V1 proof mode = per_chain_hosted**: One ZK Email relayer recovery request per guardian per chain. Do not assume one proof can be reused across chains until tested.

4. **Resend is NOT the V1 proof path**: Guardian approval requires DKIM-signed email replies to the ZK Email relayer. Web page clicks cannot generate valid ZK proofs. Resend is future-only for notification emails.

5. **Guardian web app is informational only**: `/email-recovery/:groupId/:approvalId` shows recovery details and the reply command. It cannot approve or confirm recovery.

6. **Backend server role**: `apps/backend/zk-email-recovery-api/` is a ZK Email relayer proxy, not an email sender. It calls the hosted relayer endpoints and orchestrates group/submission tracking.

7. **Legacy nonce concern**: The legacy 96-byte `PasskeyInit` path in `EmailRecovery.recover()` does NOT increment `_emailRecoveryNonces`. If a legacy recovery is executed, the nonce stays at its previous value, potentially causing scope nonce mismatches in subsequent V1 recoveries.

8. **Future-only items**: `reusable` proof mode, `self_hosted_global_email` proof mode, Resend notification emails, direct on-chain execution without relayer.

### Dev-Only Local Harness (2026-05-01)

Production uses real `EmailRecovery` + ZK Email hosted relayer. Local mock uses `EmailRecoveryHarness` only to simulate `EmailRecoveryManager` guardian acceptance and recovery voting state without real email proofs. The harness is never deployed to testnet or production.

**Production flow**:
```text
ZK Email relayer -> guardian replies -> proofs -> handleAcceptance/handleRecovery -> completeRecovery
```

**Local harness flow**:
```text
exposedAcceptGuardian/exposedProcessRecovery -> completeRecovery
```

Both flows end at the same `completeRecovery(account, recoveryData)` entrypoint. The harness skips the ZK Email proof verification but exercises the real Trezo recovery logic.

Key files:
- `contracts/test/harness/EmailRecoveryHarness.sol` — dev-only harness, exposes `acceptGuardian` and `processRecovery`
- `contracts/test/modules/EmailRecoveryMultichainHarness.t.sol` — Foundry tests proving completeRecovery path
- `contracts/script/dev/DeployMockEmailRecovery.s.sol` — local Anvil-only deployment, reverts on non-local chains
- `contracts/script/dev/MockCompleteEmailRecovery.s.sol` — local Anvil-only manual completion helper
- `contracts/script/DeployEmailRecovery.s.sol` — production/testnet deployment (unchanged, deploys real EmailRecovery only)

Makefile commands:
- `make deploy-email-local` — production-equivalent local deployment
- `make deploy-email-recovery-local-harness` — local Anvil-only harness deployment
- `make test-email-recovery-harness` — Foundry harness tests
- `make mock-complete-email-recovery-local` — local manual completion helper

Rules:
- `make deploy-local` deploys the normal production-equivalent stack (unchanged)
- Harness deployment requires explicit `make deploy-email-recovery-local-harness`
- No production/testnet deploy target references `EmailRecoveryHarness`
- Production `EmailRecovery.sol` has no public mock/bypass function
