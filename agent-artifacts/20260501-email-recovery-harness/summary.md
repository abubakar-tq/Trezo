## Dev-only EmailRecovery Harness

### What was implemented

A local-only testing harness for the Level 3 zk-email recovery flow that proves `completeRecovery(account, recoveryData)` correctly decodes multichain recoveryData, validates local chain scope, and adds the new passkey through `SmartAccount.addPasskeyFromRecovery`.

### Key outcomes

- Production `EmailRecovery.sol` has zero modifications — no public bypass/mock functions added
- `EmailRecoveryHarness` lives in `test/harness/` and is never imported by production contracts
- 9 Foundry tests pass proving completeRecovery path with multichain data
- All existing EmailRecovery tests (23 unit + 1 integration) still pass
- Deployment scripts are cleanly separated: production deploys real module, harness is local-only
- `make deploy-local` is unchanged (production-equivalent local stack)
- Harness available only through explicit `make deploy-email-recovery-local-harness`
