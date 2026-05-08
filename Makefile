# trezo/Makefile
# Root-level convenience targets for the Trezo monorepo.
# All contracts work is delegated to contracts/Makefile.

.PHONY: fork-base bundler-fork-base deploy-fork-base deploy-email-fork-base fund-bundler-fork-base check-balance-fork-base seed-fork-swap-wallet start-fork-and-bundler

## Start the Base mainnet fork (runs on infra laptop at 192.168.100.68:8545)
fork-base:
	cd apps/backend/bundler && ./scripts/start-base-fork.sh

## Start the bundler stack against the Base fork
bundler-fork-base:
	cd apps/backend/bundler && docker compose -f docker-compose.fork.yml up

## Start fork and bundler together (run on infra laptop)
start-fork-and-bundler:
	cd apps/backend/bundler && bash ./scripts/start-fork-and-bundler.sh

## Deploy Trezo contracts to the Base fork and sync mobile manifests
deploy-fork-base:
	$(MAKE) -C contracts deploy-fork-base

## Deploy email recovery contracts to the Base fork (DKIM signer + kill-switch = Anvil default account)
deploy-email-fork-base:
	$(MAKE) -C contracts deploy-email-fork-base

## Fund the Alto bundler executor so it can relay UserOperations on the Base fork
fund-bundler-fork-base:
	$(MAKE) -C contracts fund-bundler-fork-base

## Check ETH / USDC / WETH balances on the Base fork — usage: make check-balance-fork-base ACCOUNT=0x...
check-balance-fork-base:
	$(MAKE) -C contracts check-balance-fork-base ACCOUNT=$(ACCOUNT)

## Seed the Trezo smart account on the fork with native ETH and forked USDC
seed-fork-swap-wallet:
	./scripts/fork/seed-base-swap-wallet.sh

## Watch for new account deployments on the Base fork and auto-fund them
auto-fund-fork-base:
	./scripts/fork/auto-fund-accounts.sh
