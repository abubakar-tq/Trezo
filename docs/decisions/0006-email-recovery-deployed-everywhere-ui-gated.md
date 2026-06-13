# EmailRecovery deployed on every testnet; mobile UI gated to Base Sepolia

**Status:** accepted
**Date:** 2026-05-11

## Decision

The `EmailRecovery` module is deployed via the deterministic Safe Singleton Factory flow on all three testnets (Sepolia, Base Sepolia, Arbitrum Sepolia). The mobile app exposes email-recovery actions only on chains where `NetworkConfig.emailRecoverySupported` is true — currently Base Sepolia alone, since the ZK Email hosted relayer is only available there.

## Why

Trezo's portable-address invariant requires every infra contract to deploy at the same address across all `Testnet wallet ops` chains. Skipping the deploy on Sepolia / Arbitrum Sepolia would break that invariant and create an asymmetry the rest of the codebase doesn't expect. Instead, we keep on-chain symmetry and push the feature gating into mobile config, where it's reversible per chain when ZK Email expands relayer coverage.

## Considered alternatives

- **Deploy only on Base Sepolia:** rejected — breaks portable-address invariant.
- **Self-host ZK Email relayer on Sepolia + Arb Sepolia:** rejected — heavyweight off-chain infra (proof generation, DKIM oracle) is overkill for testnet phase.

## Consequences

Future contributors will see `EmailRecovery` deployed on Sepolia and wonder why the mobile UI never calls it. The `emailRecoverySupported` flag in `NetworkConfig` is the answer, and CONTEXT.md's `Testnet wallet ops` + recovery section explains. When ZK Email adds relayer support for a chain, flipping the flag is a one-line config change.
