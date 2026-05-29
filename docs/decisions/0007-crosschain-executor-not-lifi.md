# Cross-chain swap via own `CrossChainExecutor` module, not an aggregator

**Status:** accepted
**Date:** 2026-05-11

## Decision

Cross-chain swap is implemented by depositing into the Across V3 SpokePool on the source chain and routing the bridged token through a Trezo-deployed `CrossChainExecutor` contract on the destination chain, which performs the destination-side Uniswap V3 swap and forwards the output to the user's smart account. We do not use LI.FI, Socket, or any other hosted aggregator API.

## Why

Cross-chain swap is a primary differentiator of the Trezo wallet. Routing through a hosted aggregator means trusting a third party's routing engine, sponsor key, refund policy, and uptime — all of which can rate-limit or shut down without notice. The `CrossChainExecutor` is ~50 lines of solidity, deploys deterministically via the same Safe Singleton Factory flow as the rest of our infra, and means the entire cross-chain path runs on permissionless infrastructure (Across SpokePool + Uniswap V3 router) without a single API call to an off-chain routing service.

## Considered alternatives

- **LI.FI / Socket aggregator (client-only):** rejected. Wider asset coverage, but external API dependency, hosted refund policy, weaker self-custody story.
- **Bridge-only (no swap on arrival):** rejected. Forces the user into a two-step "bridge USDC, then swap on the destination chain" flow — two signed actions, double the latency, double the failure surface.
- **Defer cross-chain entirely:** rejected. Cross-chain swap is core product positioning.

## Consequences

A new contract on every chain in `Testnet wallet ops`. CrossChainExecutor addresses are not identical across chains because constructor args (SpokePool, SwapRouter) differ — the deployment manifest is the source of truth, not a portable predicted address. Adds a ~50-line audit surface. Destination Uniswap V3 pool liquidity becomes critical: if the WETH↔USDC pool on Arbitrum Sepolia dies, cross-chain swap to Arbitrum Sepolia refunds USDC instead of delivering ETH.
