## Files Changed

### contracts/test/harness/EmailRecoveryHarness.sol
Dev-only harness inheriting EmailRecovery. Exposes `exposedAcceptGuardian` and `exposedProcessRecovery` to simulate ZK Email manager state without real email proofs.

### contracts/test/modules/EmailRecoveryMultichainHarness.t.sol
9 Foundry tests proving completeRecovery adds passkey, rejects replay, wrong chain scope, wrong nonce, wrong guardianSetHash, wrong policyHash, expired deadline. Also tests multichain two-chain scope and legacy 96-byte path.

### contracts/script/dev/DeployMockEmailRecovery.s.sol
Local Anvil-only deployment script for EmailRecoveryHarness. Hard-reverts on non-local chain IDs (31337/31338/31339). Writes harness address to deployment JSON with `isHarnessDeployment: true`.

### contracts/script/dev/MockCompleteEmailRecovery.s.sol
Local Anvil-only manual completion helper. Loads harness address and recoveryData from env vars, calls completeRecovery, optionally verifies passkey in PasskeyValidator.

### contracts/Makefile
Added three local-only targets: `deploy-email-recovery-local-harness`, `test-email-recovery-harness`, `mock-complete-email-recovery-local`. Updated help text. `deploy-local` is unchanged.

### agent-plans/level-3-zk-email/README.md
Added "Dev-Only Local Harness" section documenting production vs harness flow, key files, Makefile commands, and separation rules.
