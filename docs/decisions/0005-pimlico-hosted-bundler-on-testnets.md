# Pimlico hosted bundler + paymaster on testnets; self-hosted Alto on Anvil and fork

**Status:** accepted
**Date:** 2026-05-11

## Decision

The 3 testnets in `Testnet wallet ops` (Sepolia, Base Sepolia, Arbitrum Sepolia) use Pimlico's hosted ERC-4337 bundler and paymaster. Anvil (local) and the Base mainnet fork continue to use self-hosted Alto + paymaster as they do today.

## Why

Self-hosting one bundler + one paymaster is cheap. Self-hosting three of each, with funded paymasters per chain, is operationally expensive for a single dev — node uptime, monitoring, signing-key rotation, and capital management on every chain. The Activation sheet's UX premise is gasless deploys, so the paymaster is not optional. Pimlico provides free-tier testnet bundlers and paymasters that satisfy the testnet-demoable rule without ops burden. Anvil/fork stays self-hosted because the local network has no hosted-provider option and the fork is throw-away.

## Considered alternatives

- **Self-host on all chains:** rejected for ops cost.
- **No paymaster on testnets:** rejected — breaks gasless Activation UX.
- **Mixed (hosted on one, self-hosted on two):** rejected for code-path duplication.

## Consequences

Mobile-side `bundlerUrl` / `paymasterUrl` env vars point at Pimlico endpoints on testnets, at local `http://laptop-ip:4337/3000` on Anvil/fork. Two code paths for sponsorship-policy concerns: Pimlico dashboard for testnets, in-code policy for Alto.
