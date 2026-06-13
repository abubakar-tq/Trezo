# Self-hosted on-demand Across relayer for testnet bridge latency

**Status:** accepted
**Date:** 2026-05-11

## Decision

For testnet demos, Trezo runs its own instance of the upstream `across-protocol/relayer` Docker image, brought up on demand via `make relayer-up` and torn down via `make relayer-down`. The relayer is funded with a small float of testnet WETH and USDC on each `Testnet wallet ops` chain and wins the permissionless filler race against the Across community testnet relayer because no other filler is paying attention. This brings testnet bridge latency from minutes-to-hours down to ~30 seconds, matching mainnet UX. We do not run a relayer on mainnet — the mainnet filler market is competitive and Trezo is not a filler.

## Why

Across testnet bridges are slow because no relayer has economic incentive to fill — the community relayer the Across team runs is goodwill only and polls infrequently. The cross-chain swap demo requires the bridge to complete in seconds; the alternatives are (a) faking the bridge (violates testnet-demoable rule), (b) deferring cross-chain to mainnet (violates the product-positioning argument behind ADR-0003), or (c) running our own real Across relayer (this decision). Running a real relayer keeps the on-chain path identical to mainnet — we are not mocking, we are participating in the protocol as a permissionless filler.

## Considered alternatives

- **Demo-mode UI banner ("typical testnet latency 5–30 min"):** rejected. Live demos are a primary use of testnet; a banner is honest but loses the demo.
- **24/7 relayer:** rejected. Adds always-on infra costs and key-management ops without proportional benefit. On-demand covers all known demo windows.
- **Defer cross-chain demos to mainnet:** rejected. Cross-chain validation needs to happen during the testnet phase.

## Consequences

A new `infra/relayer/` directory containing the docker-compose, config, and runbook. A throwaway relayer wallet, never reusing the deployer keystore. Ops responsibility to run `relayer-up` before each demo and `relayer-down` after. Relayer wallet must be funded with testnet WETH+USDC on all 3 chains (the relayer earns it back via deposit settlement, so the float is small).
