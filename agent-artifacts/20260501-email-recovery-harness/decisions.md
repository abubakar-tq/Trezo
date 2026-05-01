## Decisions

1. **Harness exposes acceptGuardian/processRecovery, not recover()** — The goal is to simulate the ZK Email manager's guardian acceptance and recovery voting state. The actual recovery execution must go through `completeRecovery()`, which is the real external entrypoint.

2. **No production EmailRecovery.sol changes** — Adding public bypass functions to production code is explicitly forbidden. The harness inherits EmailRecovery but is never deployed outside test/dev paths.

3. **Hard chain ID revert in deploy scripts** — Both `DeployMockEmailRecovery` and `MockCompleteEmailRecovery` revert on any chain ID that is not 31337, 31338, or 31339. This prevents accidental harness deployment to testnet or production.

4. **`make deploy-local` unchanged** — The existing local deploy target continues to deploy the production-equivalent stack. Harness deployment requires the explicit `make deploy-email-recovery-local-harness` command.

5. **Deployment JSON includes `isHarnessDeployment: true`** — When the harness is deployed, the deployment JSON is marked so consumers can distinguish it from a production deployment.
