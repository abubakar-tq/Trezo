## Test Results

### Harness tests
```
forge test --match-contract EmailRecoveryMultichainHarnessTest -vv

9 tests: ALL PASSED
- testCompleteRecoveryAddsNewPasskey
- testReplaySameRecoveryDataFailsAfterNonceIncrement
- testCompleteRecoveryRejectsChainNotInScope
- testCompleteRecoveryRejectsWrongNonce
- testCompleteRecoveryRejectsWrongGuardianSetHash
- testCompleteRecoveryRejectsWrongPolicyHash
- testCompleteRecoveryRejectsExpiredDeadline
- testMultichainTwoChainsLocalScopeValidates
- testLegacyRecoveryPathStillWorks
```

### Existing EmailRecovery tests (regression)
```
forge test --match-contract EmailRecoveryTest -vv
23 tests: ALL PASSED

forge test --match-contract EmailRecoveryIntegrationTest -vv
1 test: PASSED
```
