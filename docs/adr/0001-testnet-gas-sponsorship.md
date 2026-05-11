# Pimlico paymaster sponsors all UserOps on testnets

**Context.** The App-improvements brief's Rule 2 says only the deploy UserOp is paymaster-sponsored; subsequent UserOps come from the user's testnet ETH balance. In practice this is unworkable for a testnet demo: testnet faucets are rate-limited, captcha-gated, and frequently refuse smart-contract addresses, so users cannot reliably fund their predicted smart-account address. Without funding, every post-deploy UserOp fails with `AA21 didn't pay prefund`.

**Decision.** On the three public testnets (Sepolia, Base Sepolia, Arb Sepolia) we configure the Pimlico project's sponsorship policy to cover **all UserOps from any sender** — deploys, sends, swaps, and dApp transactions alike. Pimlico's Hobby tier is free and absorbs the testnet ETH cost. Anvil continues to use the local mock-paymaster which already sponsors everything. Mainnet is unaffected by this ADR and will revert to deploy-only sponsorship when that rollout begins.

**Consequence.** `usePaymaster: true` is passed unconditionally for every UserOp built on a wallet-ops chain. `CONTEXT.md` flags the brief's Rule 2 as testnet-deviated. Mainnet rollout must explicitly revisit this — see future ADR for the mainnet-side flip.
