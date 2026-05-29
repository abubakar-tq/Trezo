# Decision Index

Each line below describes one ADR. Format (pipe-delimited):

    NNNN | <title> | paths: <comma-separated globs> | <one-line summary>

Lines starting with `#` are comments and ignored by tooling.
Auto-maintained by the `log-decision` skill — manual edits OK but will be re-sorted on next ADR write.

# --- ADRs below this line ---
0005 | Pimlico hosted bundler + paymaster on testnets; self-hosted Alto on Anvil and fork | paths: apps/mobile/src/integration/networks.ts, apps/mobile/.env.example, infra/bundler/** | Testnet UserOp + sponsorship via Pimlico; Anvil/fork stays on Alto.
0006 | EmailRecovery deployed on every testnet; mobile UI gated to Base Sepolia | paths: contracts/script/DeployEmailRecovery.s.sol, apps/mobile/src/integration/networks.ts, apps/mobile/src/features/wallet/services/ZkEmail* | Preserve portable-address invariant; gate feature in mobile config.
0007 | Cross-chain swap via own CrossChainExecutor module, not an aggregator | paths: contracts/src/modules/CrossChainExecutor.sol, contracts/script/DeployInfra.s.sol, apps/mobile/src/features/swaps/config/bridgeRegistry.ts | Self-custodied Across-deposit-with-callback path; no hosted aggregator.
0008 | Self-hosted on-demand Across relayer for testnet bridge latency | paths: infra/relayer/**, contracts/Makefile | Win the testnet filler race ourselves to keep bridge latency demo-viable.
0009 | On-chain `recoveryRequests` is the source of truth for Recovery Attempt execution lifecycle; Supabase holds only what is not on-chain | paths: apps/mobile/src/features/wallet/services/EmailRecovery*, apps/mobile/src/features/profile/screens/EmailRecovery*, apps/backend/supabase/functions/submit-recovery-operation/** | Read chain via multicall on the detail screen; banner reads Supabase for existence only; drop mirror columns from Supabase schema.
0010 | Expired Recovery Attempt slots are reclaimed by Trezo-operated `RECOVERY_RELAYER_PRIVATE_KEY` EOA via Supabase edge function, not by user signature | paths: apps/backend/supabase/functions/submit-recovery-operation/**, apps/mobile/src/features/wallet/services/EmailRecoveryGroupService.ts | Server-side cancel-expired-email-recovery action; lazy trigger on user intent; sub-penny per call.
0011 | Recovery Attempt is initiated only from a new device in production; same-device "Start Email Recovery" is testing-only and ships behind `__DEV__` | paths: apps/mobile/src/features/profile/screens/EmailRecoveryScreen.tsx, apps/mobile/src/features/profile/screens/EmailRecoveryStartScreen.tsx | Production new-device entry is v2 scope; v1 polish exercises the same code path via dev-gated same-device flow.
