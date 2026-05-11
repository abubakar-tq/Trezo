-include .env
# trezo/contracts/Makefile

DEFAULT_ANVIL_KEY := 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

DEFAULT_ANVIL_ACCOUNT := 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

ANVIL_RPC_URL ?= http://$(LAPTOP_IP):8545
LOCAL_PRIVATE_KEY ?= $(DEFAULT_ANVIL_KEY)

# Where the Expo app lives (relative to contracts/)
MOBILE_DIR ?= ../apps/mobile/src/integration

# Where the Ponder indexer lives (relative to contracts/)
INDEXER_DIR ?= ../apps/backend/indexer


# Chain IDs (must match the actual networks)
CHAIN_ID_LOCAL    ?= 31337
CHAIN_ID_SEPOLIA  ?= 11155111

RPC_URL ?= $(ANVIL_RPC_URL)
CHAIN_ID ?= $(CHAIN_ID_LOCAL)
SCRIPT_VERBOSITY ?= -vvvv

# ── Base Fork ────────────────────────────────────────────────────────────────
BASE_FORK_RPC_URL   ?= http://$(LAPTOP_IP):8545
BASE_FORK_CHAIN_ID  ?= 8453
BASE_FORK_PROFILE   ?= base-mainnet-fork
ENTRYPOINT         ?= 0x0000000071727De22E5E9d8BAf0edAc6f37da032

# ── Testnet deployer keystore + Etherscan verify ─────────────────────────────
# Created once via: cast wallet import trezo-testnet-deployer --interactive
DEPLOYER_KEYSTORE ?= trezo-testnet-deployer
ETHERSCAN_API_KEY ?=
VERIFY_FLAGS := $(if $(ETHERSCAN_API_KEY),--verify --etherscan-api-key $(ETHERSCAN_API_KEY))
KEYSTORE_FLAGS := --account $(DEPLOYER_KEYSTORE)

# ── Testnet RPC URLs (set in .env or pass via env) ──────────────────────────
SEPOLIA_RPC_URL      ?=
BASE_SEPOLIA_RPC_URL ?= https://sepolia.base.org
ARB_SEPOLIA_RPC_URL  ?= https://sepolia-rollup.arbitrum.io/rpc

ANVIL_NETWORK_ARGS := --rpc-url $(ANVIL_RPC_URL) --private-key $(LOCAL_PRIVATE_KEY) --broadcast $(SCRIPT_VERBOSITY)

DEPLOY_SCRIPT_ENV := \
	$(if $(PRIVATE_KEY),PRIVATE_KEY=$(PRIVATE_KEY)) \
	$(if $(ENTRYPOINT),ENTRYPOINT=$(ENTRYPOINT)) \
	$(if $(DEPLOYMENT_NAMESPACE),DEPLOYMENT_NAMESPACE=$(DEPLOYMENT_NAMESPACE)) \
	$(if $(DEPLOYMENT_PROFILE),DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE))

OPTIONAL_ENTRYPOINT_MAKE := $(if $(ENTRYPOINT),ENTRYPOINT=$(ENTRYPOINT))

PREDICT_WALLET_ENV := \
	$(if $(ACCOUNT_FACTORY),ACCOUNT_FACTORY=$(ACCOUNT_FACTORY)) \
	$(if $(WALLET_ID),WALLET_ID=$(WALLET_ID)) \
	$(if $(WALLET_INDEX),WALLET_INDEX=$(WALLET_INDEX)) \
	$(if $(VALIDATOR),VALIDATOR=$(VALIDATOR)) \
	$(if $(PASSKEY_ID_RAW),PASSKEY_ID_RAW=$(PASSKEY_ID_RAW)) \
	$(if $(PASSKEY_PX),PASSKEY_PX=$(PASSKEY_PX)) \
	$(if $(PASSKEY_PY),PASSKEY_PY=$(PASSKEY_PY))

.PHONY: help
help:
	@echo "Common targets:"
	@echo "  make bootstrap                          # one-time: init submodules + install modulekit pnpm deps"
	@echo "  make build"
	@echo "  make deploy-local"
	@echo "  make predict-local"
	@echo "  make verify-local"
	@echo "  make deploy-email-local"
	@echo ""
	@echo "Deterministic infra flow:"
	@echo "  make check-root-factory RPC_URL=<rpc>"
	@echo "  make check-chain-support RPC_URL=<rpc>"
	@echo "  make predict-infra RPC_URL=<rpc> [ENTRYPOINT=...]"
	@echo "  make deploy-infra RPC_URL=<rpc> PRIVATE_KEY=<pk> [ENTRYPOINT=...]"
	@echo "  make verify-infra RPC_URL=<rpc> [ENTRYPOINT=...]"
	@echo "  make predict-wallet RPC_URL=<rpc> ACCOUNT_FACTORY=<addr> WALLET_ID=<bytes32> VALIDATOR=<addr> PASSKEY_ID_RAW=<bytes32> PASSKEY_PX=<uint256> PASSKEY_PY=<uint256> [WALLET_INDEX=0]"
	@echo ""
	@echo "Local dev harness (NEVER on testnet/prod):"
	@echo "  make deploy-email-recovery-local-harness  # deploy EmailRecoveryHarness on Anvil"
	@echo "  make test-email-recovery-harness          # run harness Foundry tests"
	@echo "  make mock-accept-guardians-local          # accept guardians on harness (Anvil)"
	@echo "  make mock-vote-recovery-local             # vote for recovery on harness (Anvil)"
	@echo "  make mock-complete-email-recovery-local   # complete recovery on Anvil"
	@echo ""
	@echo "Examples:"
	@echo "  make check-root-factory RPC_URL=\$$SEPOLIA_RPC_URL"
	@echo "  make deploy-sepolia SEPOLIA_RPC_URL=... ETHERSCAN_API_KEY=..."
	@echo "  make deploy-base-sepolia ETHERSCAN_API_KEY=...   # uses default RPC https://sepolia.base.org"
	@echo "  make deploy-arb-sepolia ETHERSCAN_API_KEY=...    # uses default RPC https://sepolia-rollup.arbitrum.io/rpc"
	@echo "  make swap-healthcheck DEPLOYMENT_PROFILE=base-sepolia RPC_URL=\$$BASE_SEPOLIA_RPC_URL"
	@echo "  make relayer-up   # bring up the on-demand Across relayer for cross-chain demos"
	@echo "  make predict-wallet RPC_URL=\$$BASE_RPC_URL ACCOUNT_FACTORY=0x... WALLET_ID=0x... VALIDATOR=0x... PASSKEY_ID_RAW=0x... PASSKEY_PX=... PASSKEY_PY=... WALLET_INDEX=0"
	@echo ""
	@echo "Testnet deploy prerequisites:"
	@echo "  - cast wallet import trezo-testnet-deployer --interactive   # once"
	@echo "  - Fund deployer address with ~0.1 ETH on each testnet"
	@echo "  - Set ETHERSCAN_API_KEY (Etherscan v2 multichain) in .env"
	@echo "  - Set PIMLICO_API_KEY in apps/mobile/.env (for bundler/paymaster URLs)"

.PHONY: bootstrap
bootstrap:
	@echo "Initializing git submodules..."
	git -C .. submodule update --init --recursive
	@echo "Installing modulekit pnpm deps (required for forge build)..."
	@echo "Note: --node-linker=hoisted + --package-import-method=copy are required when running pnpm against a Windows-mounted drive (/mnt/d) from WSL; plain pnpm install fails with ERR_PNPM_EACCES on DrvFs."
	cd lib/modulekit && pnpm install --frozen-lockfile --config.node-linker=hoisted --config.package-import-method=copy

.PHONY: build
build:
	forge build

# ---------- Deploy targets ----------

.PHONY: deploy-local
deploy-local:
	@echo "Deploying the local stack through the canonical Safe-root flow."
	@echo "Note: 31337 is not allowlisted as a portable release chain, so deploy-local skips check-chain-support."
	$(MAKE) check-root-factory RPC_URL=$(ANVIL_RPC_URL)
	$(MAKE) predict-local $(OPTIONAL_ENTRYPOINT_MAKE)
	$(MAKE) deploy-infra RPC_URL=$(ANVIL_RPC_URL) PRIVATE_KEY=$(LOCAL_PRIVATE_KEY) DEPLOYMENT_NAMESPACE=local $(OPTIONAL_ENTRYPOINT_MAKE)
	$(MAKE) verify-local $(OPTIONAL_ENTRYPOINT_MAKE)
	$(MAKE) deploy-email-recovery-local-harness

.PHONY: deploy-email-local
deploy-email-local: build
	forge script script/DeployEmailRecovery.s.sol:DeployEmailRecovery \
	$(ANVIL_NETWORK_ARGS)
	$(MAKE) sync-mobile CHAIN_ID=$(CHAIN_ID_LOCAL)
	$(MAKE) sync-abi

.PHONY: deploy-email-sepolia
deploy-email-sepolia: build
	@echo "Deploying email recovery after canonical infra deployment on Sepolia."
	forge script script/DeployEmailRecovery.s.sol:DeployEmailRecovery \
		--rpc-url $(SEPOLIA_RPC_URL) \
		$(KEYSTORE_FLAGS) \
		--broadcast \
		$(VERIFY_FLAGS) \
		-vvv

.PHONY: ping-anvil
ping-anvil:
	@echo "Pinging Anvil network at $(ANVIL_RPC_URL) ..."
	cast block-number --rpc-url $(ANVIL_RPC_URL)

.PHONY: warp-time
warp-time:
	@echo "Fast-forwarding Anvil by 1 day (86400 seconds) and mining a block..."
	cast rpc evm_increaseTime 86400 --rpc-url $(ANVIL_RPC_URL)
	cast rpc evm_mine --rpc-url $(ANVIL_RPC_URL)

# ---------- Deterministic infra targets ----------

.PHONY: check-root-factory
check-root-factory:
	forge script script/CheckRootFactory.s.sol:CheckRootFactory \
		--rpc-url $(RPC_URL) \
		$(SCRIPT_VERBOSITY)

.PHONY: check-chain-support
check-chain-support:
	forge script script/CheckChainSupport.s.sol:CheckChainSupport \
		--rpc-url $(RPC_URL) \
		$(SCRIPT_VERBOSITY)

.PHONY: predict-infra
predict-infra:
	$(DEPLOY_SCRIPT_ENV) forge script script/PredictInfra.s.sol:PredictInfra \
		--rpc-url $(RPC_URL) \
		$(SCRIPT_VERBOSITY)

.PHONY: deploy-infra
deploy-infra: build
	$(DEPLOY_SCRIPT_ENV) forge script script/DeployInfra.s.sol:DeployInfra \
		--rpc-url $(RPC_URL) \
		$(if $(USE_KEYSTORE),$(KEYSTORE_FLAGS),--private-key $(PRIVATE_KEY)) \
		--broadcast \
		$(VERIFY_FLAGS) \
		$(SCRIPT_VERBOSITY)

.PHONY: verify-infra
verify-infra:
	$(DEPLOY_SCRIPT_ENV) forge script script/VerifyInfra.s.sol:VerifyInfra \
		--rpc-url $(RPC_URL) \
		$(SCRIPT_VERBOSITY)

.PHONY: predict-wallet
predict-wallet:
	$(PREDICT_WALLET_ENV) forge script script/PredictWallet.s.sol:PredictWallet \
		--rpc-url $(RPC_URL) \
		$(SCRIPT_VERBOSITY)

.PHONY: deploy-infra-sepolia
deploy-infra-sepolia:
	$(MAKE) deploy-infra RPC_URL=$(SEPOLIA_RPC_URL)

.PHONY: predict-local
predict-local:
	$(MAKE) predict-infra RPC_URL=$(ANVIL_RPC_URL) $(OPTIONAL_ENTRYPOINT_MAKE)

.PHONY: verify-local
verify-local:
	$(MAKE) check-root-factory RPC_URL=$(ANVIL_RPC_URL)
	$(MAKE) verify-infra RPC_URL=$(ANVIL_RPC_URL) $(OPTIONAL_ENTRYPOINT_MAKE)

.PHONY: predict-infra-sepolia
predict-infra-sepolia:
	$(MAKE) predict-infra RPC_URL=$(SEPOLIA_RPC_URL)

.PHONY: verify-infra-sepolia
verify-infra-sepolia:
	$(MAKE) verify-infra RPC_URL=$(SEPOLIA_RPC_URL)

.PHONY: check-root-factory-sepolia
check-root-factory-sepolia:
	$(MAKE) check-root-factory RPC_URL=$(SEPOLIA_RPC_URL)

.PHONY: check-chain-support-sepolia
check-chain-support-sepolia:
	$(MAKE) check-chain-support RPC_URL=$(SEPOLIA_RPC_URL)

# ---------- Sync artifacts to mobile ----------

# Needs: jq installed
.PHONY: sync-mobile
sync-mobile:
	@echo "Syncing artifacts to $(MOBILE_DIR)"
	mkdir -p $(MOBILE_DIR)/contracts
ifeq ($(DEPLOYMENT_PROFILE),)
	# Default: copy by chain-id
	cp deployments/$(CHAIN_ID).json \
		$(MOBILE_DIR)/contracts/deployment.$(CHAIN_ID).json
else
	# Profile-aware: copy by deployment profile
	cp deployments/$(DEPLOYMENT_PROFILE).json \
		$(MOBILE_DIR)/contracts/deployment.$(DEPLOYMENT_PROFILE).json
endif

.PHONY: sync-abi
sync-abi:
	mkdir -p $(MOBILE_DIR)/abi
	# ABI-only JSONs for the mobile app
	jq '{abi: .abi}' out/SmartAccount.sol/SmartAccount.json \
		> $(MOBILE_DIR)/abi/SmartAccount.json

	jq '{abi: .abi}' out/AccountFactory.sol/AccountFactory.json \
		> $(MOBILE_DIR)/abi/AccountFactory.json

	jq '{abi: .abi}' out/MinimalProxyFactory.sol/MinimalProxyFactory.json \
		> $(MOBILE_DIR)/abi/MinimalProxyFactory.json

	jq '{abi: .abi}' out/PasskeyValidator.sol/PasskeyValidator.json \
		> $(MOBILE_DIR)/abi/PasskeyValidator.json

	jq '{abi: .abi}' out/SocialRecovery.sol/SocialRecovery.json \
		> $(MOBILE_DIR)/abi/SocialRecovery.json

	jq '{abi: .abi}' out/EmailRecovery.sol/EmailRecovery.json \
		> $(MOBILE_DIR)/abi/EmailRecovery.json

# ---------- Sync deployment JSON to indexer ----------

# Copies deployment JSON into the indexer directory so addresses.ts can read them.
# Run after deploy-local or deploy-fork-base.
.PHONY: sync-indexer
sync-indexer:
	@echo "Syncing deployment artifacts to $(INDEXER_DIR)"
	mkdir -p $(INDEXER_DIR)/../../../contracts/deployments
	@echo "Deployment JSONs are read directly from contracts/deployments/ by addresses.ts"
	@echo "No copy needed — indexer reads from relative path ../../../contracts/deployments/"
	@echo "Done."

# ── Base Fork Deploy ─────────────────────────────────────────────────────────

.PHONY: deploy-fork-base
deploy-fork-base:
	@echo "Deploying Trezo infra to Base mainnet fork at $(BASE_FORK_RPC_URL)"
	$(MAKE) check-root-factory RPC_URL=$(BASE_FORK_RPC_URL)
	$(MAKE) predict-infra RPC_URL=$(BASE_FORK_RPC_URL) ENTRYPOINT=$(ENTRYPOINT)
	$(MAKE) deploy-infra \
		RPC_URL=$(BASE_FORK_RPC_URL) \
		PRIVATE_KEY=$(LOCAL_PRIVATE_KEY) \
		DEPLOYMENT_NAMESPACE=$(BASE_FORK_PROFILE) \
		DEPLOYMENT_PROFILE=$(BASE_FORK_PROFILE) \
		ENTRYPOINT=$(ENTRYPOINT)
	$(MAKE) verify-infra RPC_URL=$(BASE_FORK_RPC_URL) ENTRYPOINT=$(ENTRYPOINT)
	$(MAKE) deploy-email-fork-base
	$(MAKE) fund-bundler-fork-base
	$(MAKE) sync-mobile CHAIN_ID=$(BASE_FORK_CHAIN_ID) DEPLOYMENT_PROFILE=$(BASE_FORK_PROFILE)
	$(MAKE) sync-abi

# Deploy email recovery contracts to the Base fork.
# Uses Anvil default account as both DKIM signer and kill-switch authorizer — fine for dev.
# sync-mobile + sync-abi are intentionally omitted here; deploy-fork-base runs them after.
.PHONY: deploy-email-fork-base
deploy-email-fork-base: build
	@echo "Deploying EmailRecovery to Base mainnet fork at $(BASE_FORK_RPC_URL)"
	KILL_SWITCH_AUTHORIZER=$(DEFAULT_ANVIL_ACCOUNT) \
	DKIM_SIGNER=$(DEFAULT_ANVIL_ACCOUNT) \
	DEPLOYMENT_PROFILE=$(BASE_FORK_PROFILE) \
	forge script script/DeployEmailRecovery.s.sol:DeployEmailRecovery \
		--rpc-url $(BASE_FORK_RPC_URL) \
		--private-key $(LOCAL_PRIVATE_KEY) \
		--broadcast \
		-vvvv

# Fund the Alto bundler executor on the Base fork so it can submit UserOperations.
# Alto uses Anvil key #0 by default (address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266).
ALTO_EXECUTOR_ADDRESS ?= 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BUNDLER_FUND_ETH     ?= 10

.PHONY: fund-bundler-fork-base
fund-bundler-fork-base:
	@echo "Funding Alto bundler executor $(ALTO_EXECUTOR_ADDRESS) with $(BUNDLER_FUND_ETH) ETH on fork..."
	@WEI_HEX=$$(python3 -c "print(hex(int($(BUNDLER_FUND_ETH) * 10**18)))"); \
	cast rpc anvil_setBalance $(ALTO_EXECUTOR_ADDRESS) $$WEI_HEX \
		--rpc-url $(BASE_FORK_RPC_URL)
	@echo "✅ Bundler executor funded:"
	@cast balance $(ALTO_EXECUTOR_ADDRESS) --rpc-url $(BASE_FORK_RPC_URL) --ether

# Verify ETH / USDC / WETH balances for any address on the Base fork.
# Usage: make check-balance-fork-base ACCOUNT=0x...
BASE_FORK_USDC ?= 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
BASE_FORK_WETH ?= 0x4200000000000000000000000000000000000006

.PHONY: check-balance-fork-base
check-balance-fork-base:
	@[ -n "$(ACCOUNT)" ] || (echo "❌ Set ACCOUNT=0x... to check balances" && exit 1)
	@echo "══════════════════════════════════════"
	@echo "  Balances for $(ACCOUNT) on Base fork"
	@echo "══════════════════════════════════════"
	@echo "ETH:"
	@cast balance $(ACCOUNT) --rpc-url $(BASE_FORK_RPC_URL) --ether
	@echo "USDC (raw):"
	@cast call $(BASE_FORK_USDC) "balanceOf(address)(uint256)" $(ACCOUNT) \
		--rpc-url $(BASE_FORK_RPC_URL)
	@echo "WETH (raw):"
	@cast call $(BASE_FORK_WETH) "balanceOf(address)(uint256)" $(ACCOUNT) \
		--rpc-url $(BASE_FORK_RPC_URL)
	@echo "══════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
# ---------- Local dev harness targets ----------
# These targets deploy or test the EmailRecoveryHarness, which is a dev-only
# contract that exposes internal functions for local testing. The harness is
# NEVER deployed to testnet or production. Production deploys use the real
# EmailRecovery module through deploy-email-local or deploy-email-sepolia.

.PONY: deploy-email-recovery-local-harness
deploy-email-recovery-local-harness: build
	@echo "Deploying EmailRecoveryHarness (DEV-ONLY, local Anvil)..."
	forge script script/dev/DeployMockEmailRecovery.s.sol:DeployMockEmailRecovery \
	$(ANVIL_NETWORK_ARGS)
	$(MAKE) sync-mobile CHAIN_ID=$(CHAIN_ID_LOCAL)

.PHONY: test-email-recovery-harness
test-email-recovery-harness: build
	forge test --match-contract EmailRecoveryMultichainHarnessTest -vv

.PHONY: mock-accept-guardians-local
mock-accept-guardians-local: build
	@echo "Accepting guardians on EmailRecoveryHarness (DEV-ONLY, local Anvil)..."
	@echo "Required env: ACCOUNT=<smart-account>"
	@echo "Harness address auto-read from deployments/31337.json"
	@echo "Optional env: RECOVERY_HARNESS=<override> GUARDIAN_COUNT=<n> ACCEPTANCE_TEMPLATE_IDX=<idx>"
	forge script script/dev/MockAcceptGuardians.s.sol:MockAcceptGuardians \
	$(ANVIL_NETWORK_ARGS)

.PHONY: mock-vote-recovery-local
mock-vote-recovery-local: build
	@echo "Voting for recovery on EmailRecoveryHarness (DEV-ONLY, local Anvil)..."
	@echo "Required env: ACCOUNT=<smart-account> RECOVERY_DATA=<hex>"
	@echo "Harness address auto-read from deployments/31337.json"
	@echo "Optional env: RECOVERY_HARNESS=<override> VOTE_COUNT=<n> RECOVERY_TEMPLATE_IDX=<idx>"
	forge script script/dev/MockVoteRecovery.s.sol:MockVoteRecovery \
	$(ANVIL_NETWORK_ARGS)

.PHONY: mock-complete-email-recovery-local
mock-complete-email-recovery-local: build
	@echo "Running mock email recovery completion on local Anvil (DEV-ONLY)..."
	@echo "Required env: ACCOUNT=<smart-account> RECOVERY_DATA=<hex>"
	@echo "Harness + PasskeyValidator auto-read from deployments/31337.json"
	@echo "Optional env: RECOVERY_HARNESS=<override> PASSKEY_VALIDATOR=<override> NEW_PASSKEY_ID=<bytes32> ANVIL_RPC_URL=<override>"
	forge script script/dev/MockCompleteEmailRecovery.s.sol:MockCompleteEmailRecovery \
	$(ANVIL_NETWORK_ARGS)

# ─────────────────────────────────────────────────────────────────────────────
# ---------- Testnet deploy targets (Sepolia / Base Sepolia / Arbitrum Sepolia)
# These run the canonical portable Safe-root flow with the encrypted keystore
# and Etherscan v2 verification baked in. Required env:
#   ETHERSCAN_API_KEY    — one Etherscan v2 multichain key
#   PIMLICO_API_KEY      — for the mobile-side bundler/paymaster URLs
#   The DEPLOYER_KEYSTORE (default `trezo-testnet-deployer`) must exist.

.PHONY: check-spokepool
check-spokepool:
	@[ -n "$(RPC_URL)" ] || (echo "❌ Set RPC_URL" && exit 1)
	forge script script/CheckSpokePool.s.sol:CheckSpokePool --rpc-url $(RPC_URL) $(SCRIPT_VERBOSITY)

.PHONY: swap-healthcheck
swap-healthcheck:
	@[ -n "$(DEPLOYMENT_PROFILE)" ] || (echo "❌ Set DEPLOYMENT_PROFILE=sepolia|base-sepolia|arb-sepolia" && exit 1)
	@[ -n "$(RPC_URL)" ] || (echo "❌ Set RPC_URL" && exit 1)
	DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE) forge script script/CheckSwapPools.s.sol:CheckSwapPools \
		--rpc-url $(RPC_URL) $(SCRIPT_VERBOSITY)

.PHONY: seed-swap-liquidity
seed-swap-liquidity:
	@[ -n "$(DEPLOYMENT_PROFILE)" ] || (echo "❌ Set DEPLOYMENT_PROFILE" && exit 1)
	@[ -n "$(RPC_URL)" ] || (echo "❌ Set RPC_URL" && exit 1)
	DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE) forge script script/SeedSwapLiquidity.s.sol:SeedSwapLiquidity \
		--rpc-url $(RPC_URL) $(SCRIPT_VERBOSITY)

.PHONY: deploy-sepolia
deploy-sepolia:
	@[ -n "$(SEPOLIA_RPC_URL)" ] || (echo "❌ Set SEPOLIA_RPC_URL in env" && exit 1)
	$(MAKE) check-root-factory RPC_URL=$(SEPOLIA_RPC_URL)
	$(MAKE) check-chain-support RPC_URL=$(SEPOLIA_RPC_URL)
	$(MAKE) check-spokepool RPC_URL=$(SEPOLIA_RPC_URL)
	$(MAKE) predict-infra RPC_URL=$(SEPOLIA_RPC_URL)
	$(MAKE) deploy-infra \
		RPC_URL=$(SEPOLIA_RPC_URL) \
		USE_KEYSTORE=1 \
		DEPLOYMENT_PROFILE=sepolia \
		DEPLOYMENT_NAMESPACE=sepolia
	$(MAKE) verify-infra RPC_URL=$(SEPOLIA_RPC_URL)
	$(MAKE) sync-mobile DEPLOYMENT_PROFILE=sepolia
	$(MAKE) sync-abi

.PHONY: deploy-base-sepolia
deploy-base-sepolia:
	$(MAKE) check-root-factory RPC_URL=$(BASE_SEPOLIA_RPC_URL)
	$(MAKE) check-chain-support RPC_URL=$(BASE_SEPOLIA_RPC_URL)
	$(MAKE) check-spokepool RPC_URL=$(BASE_SEPOLIA_RPC_URL)
	$(MAKE) predict-infra RPC_URL=$(BASE_SEPOLIA_RPC_URL)
	$(MAKE) deploy-infra \
		RPC_URL=$(BASE_SEPOLIA_RPC_URL) \
		USE_KEYSTORE=1 \
		DEPLOYMENT_PROFILE=base-sepolia \
		DEPLOYMENT_NAMESPACE=base-sepolia
	$(MAKE) verify-infra RPC_URL=$(BASE_SEPOLIA_RPC_URL)
	$(MAKE) sync-mobile DEPLOYMENT_PROFILE=base-sepolia
	$(MAKE) sync-abi

.PHONY: deploy-arb-sepolia
deploy-arb-sepolia:
	$(MAKE) check-root-factory RPC_URL=$(ARB_SEPOLIA_RPC_URL)
	$(MAKE) check-chain-support RPC_URL=$(ARB_SEPOLIA_RPC_URL)
	$(MAKE) check-spokepool RPC_URL=$(ARB_SEPOLIA_RPC_URL)
	$(MAKE) predict-infra RPC_URL=$(ARB_SEPOLIA_RPC_URL)
	$(MAKE) deploy-infra \
		RPC_URL=$(ARB_SEPOLIA_RPC_URL) \
		USE_KEYSTORE=1 \
		DEPLOYMENT_PROFILE=arb-sepolia \
		DEPLOYMENT_NAMESPACE=arb-sepolia
	$(MAKE) verify-infra RPC_URL=$(ARB_SEPOLIA_RPC_URL)
	$(MAKE) sync-mobile DEPLOYMENT_PROFILE=arb-sepolia
	$(MAKE) sync-abi

.PHONY: verify-chain
verify-chain:
	@[ -n "$(CHAIN)" ] || (echo "❌ Set CHAIN=sepolia|base-sepolia|arb-sepolia" && exit 1)
	@[ -n "$(ETHERSCAN_API_KEY)" ] || (echo "❌ Set ETHERSCAN_API_KEY" && exit 1)
	$(MAKE) verify-infra RPC_URL=$($(shell echo $(CHAIN) | tr 'a-z-' 'A-Z_')_RPC_URL)

# ─────────────────────────────────────────────────────────────────────────────
# ---------- Across relayer (on-demand) ----------------------------------------

RELAYER_DIR ?= ../infra/relayer

.PHONY: relayer-up
relayer-up:
	docker compose -f $(RELAYER_DIR)/docker-compose.yml up -d
	@echo "✅ Relayer up. Tail logs with: make relayer-logs"

.PHONY: relayer-down
relayer-down:
	docker compose -f $(RELAYER_DIR)/docker-compose.yml down
	@echo "✅ Relayer down."

.PHONY: relayer-logs
relayer-logs:
	docker compose -f $(RELAYER_DIR)/docker-compose.yml logs -f --tail=100

.PHONY: relayer-status
relayer-status:
	docker compose -f $(RELAYER_DIR)/docker-compose.yml ps
