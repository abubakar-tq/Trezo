# Trezo Across testnet relayer — runbook

This directory runs a self-hosted Across V3 relayer Docker container that fills bridge deposits on the three testnets in `Testnet wallet ops` (Sepolia, Base Sepolia, Arbitrum Sepolia). Used **on-demand** during testnet cross-chain swap demos to win the permissionless filler race and bring bridge latency from minutes-to-hours down to ~30 seconds.

See: `docs/decisions/0004-self-hosted-on-demand-across-relayer.md`.

## Lifecycle

```bash
cd contracts
make relayer-up        # docker compose up -d
make relayer-logs      # tail
make relayer-status    # ps
make relayer-down      # tear down
```

## First-run setup

1. **Generate a throwaway relayer wallet.** Never reuse `trezo-testnet-deployer`.
   ```bash
   cast wallet new
   ```
   Note the address and private key.

2. **Fund the relayer wallet.** From each testnet faucet, send:
   - ~0.05 ETH on Sepolia, Base Sepolia, Arbitrum Sepolia (gas)
   - ~$50-worth of USDC (Circle faucet: https://faucet.circle.com)
   - ~$50-worth of WETH (wrap native ETH on each chain via the WETH contract's `deposit()`)

   The relayer fronts capital from this wallet and earns it back on every successful fill — the float only needs to cover the largest in-flight deposit.

3. **Configure `.env`:** copy `.env.example` to `.env` and fill in:
   - `RELAYER_PRIVATE_KEY`
   - `SEPOLIA_RPC_URL` (Alchemy / Infura — public RPC is too slow for log subscription)
   - `BASE_SEPOLIA_RPC_URL` (default `https://sepolia.base.org` works; Alchemy recommended for production)
   - `ARB_SEPOLIA_RPC_URL` (default `https://sepolia-rollup.arbitrum.io/rpc` works; Alchemy recommended)

4. **Verify the pinned SpokePool addresses** in `relayer.config.json` against `https://github.com/across-protocol/contracts/tree/master/deployments`. Pin the latest published version. If you don't, the relayer will silently fail to fill.

5. **Verify the Docker image tag** in `docker-compose.yml`. Default is `ghcr.io/across-protocol/relayer:latest` — pin to a specific tag (e.g. `v3.X.X`) for reproducibility.

## Allowed routes

The relayer only fills deposits between the 3 testnets, and only for these tokens:

| Chain | Allowed input tokens |
|---|---|
| Sepolia | USDC `0x1c7D…7238`, WETH `0x7b79…7f9` |
| Base Sepolia | USDC `0x036C…CF7e`, WETH `0x4200…0006` |
| Arbitrum Sepolia | USDC `0x75fa…AA4d`, WETH `0x980B…7c73` |

Edit `allowedTokens` and `allowedRoutes` in `relayer.config.json` to change.

## Monitoring during a demo

```bash
make relayer-logs   # tail -f
```

Look for:
- `[Sepolia] Detected new V3 deposit ...` — source-side detection
- `[Base Sepolia] Submitting fillRelay ...` — destination-side fill
- `[Base Sepolia] Fill confirmed in block ...` — done

If you don't see fills happening within ~30 seconds of a deposit:
1. Check the relayer wallet has token balance on the destination chain
2. Check the destination RPC URL is responsive (`cast block-number --rpc-url $BASE_SEPOLIA_RPC_URL`)
3. Check the SpokePool addresses are correct

## Troubleshooting

- **`InsufficientBalance` in logs:** top up the relayer wallet on the destination chain.
- **`RpcError` repeated:** the public RPC is rate-limiting. Switch to Alchemy or QuickNode.
- **No deposits detected:** the source RPC may have lost log subscription. `make relayer-down && make relayer-up`.

## Kill-switch

If something goes wrong:
```bash
make relayer-down
```

Funds in the relayer wallet are testnet only — no production risk. Worst case: lose the testnet USDC float, which is replaceable from faucets.
