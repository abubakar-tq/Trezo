-include .env
# trezo/contracts/Makefile

DEFAULT_ANVIL_KEY := 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

DEFAULT_ANVIL_ACCOUNT := 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

ANVIL_RPC_URL = http://192.168.100.68:8545
LOCAL_PORTABLE_RPC_URL ?= $(ANVIL_RPC_URL)
LOCAL_PORTABLE_PRIVATE_KEY ?= $(DEFAULT_ANVIL_KEY)

# Where the Expo app lives (relative to contracts/)
MOBILE_DIR ?= ../apps/mobile/src/integration


# Chain IDs (must match the actual networks)
CHAIN_ID_LOCAL    ?= 31337
CHAIN_ID_SEPOLIA  ?= 11155111

RPC_URL ?= $(ANVIL_RPC_URL)
CHAIN_ID ?= $(CHAIN_ID_LOCAL)
SCRIPT_VERBOSITY ?= -vvvv

ANVIL_NETWORK_ARGS := --rpc-url $(ANVIL_RPC_URL) --private-key $(DEFAULT_ANVIL_KEY) --broadcast $(SCRIPT_VERBOSITY)

DEPLOY_SCRIPT_ENV := \
	$(if $(PRIVATE_KEY),PRIVATE_KEY=$(PRIVATE_KEY)) \
	$(if $(ENTRYPOINT),ENTRYPOINT=$(ENTRYPOINT))

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
	@echo "  make build"
	@echo "  make deploy-local"
	@echo "  make deploy-local-portable"
	@echo "  make deploy-local-legacy"
	@echo "  make deploy-email-local"
	@echo ""
	@echo "Deterministic infra flow:"
	@echo "  make check-root-factory RPC_URL=<rpc>"
	@echo "  make check-chain-support RPC_URL=<rpc>"
	@echo "  make predict-infra RPC_URL=<rpc> [ENTRYPOINT=...]"
	@echo "  make deploy-infra RPC_URL=<rpc> PRIVATE_KEY=<pk> [ENTRYPOINT=...]"
	@echo "  make deploy-sepolia   # compatibility alias for make deploy-infra-sepolia"
	@echo "  make validate-local-portable [LOCAL_PORTABLE_RPC_URL=<rpc>] [LOCAL_PORTABLE_PRIVATE_KEY=<pk>] [ENTRYPOINT=...]"
	@echo "  make verify-infra RPC_URL=<rpc> [ENTRYPOINT=...]"
	@echo "  make predict-wallet RPC_URL=<rpc> ACCOUNT_FACTORY=<addr> WALLET_ID=<bytes32> VALIDATOR=<addr> PASSKEY_ID_RAW=<bytes32> PASSKEY_PX=<uint256> PASSKEY_PY=<uint256> [WALLET_INDEX=0]"
	@echo ""
	@echo "Examples:"
	@echo "  make check-root-factory RPC_URL=\$$SEPOLIA_RPC_URL"
	@echo "  make deploy-sepolia PRIVATE_KEY=\$$PRIVATE_KEY"
	@echo "  make predict-wallet RPC_URL=\$$BASE_RPC_URL ACCOUNT_FACTORY=0x... WALLET_ID=0x... VALIDATOR=0x... PASSKEY_ID_RAW=0x... PASSKEY_PX=... PASSKEY_PY=... WALLET_INDEX=0"

.PHONY: build
build:
	forge build

# ---------- Deploy targets ----------

.PHONY: deploy-local
deploy-local:
	@echo "deploy-local is a compatibility alias for the canonical local portable flow."
	@echo "Use make deploy-local-legacy only when you explicitly need the old 0x4e59 path."
	$(MAKE) deploy-local-portable

.PHONY: deploy-local-portable
deploy-local-portable:
	@echo "Deploying the local stack through the canonical Safe-root infra flow."
	$(MAKE) validate-local-portable
	$(MAKE) deploy-email-local

.PHONY: deploy-local-legacy
deploy-local-legacy: build
	forge script script/DeployAccount.s.sol:DeployAccount \
	$(ANVIL_NETWORK_ARGS)
	forge script script/DeployEmailRecovery.s.sol:DeployEmailRecovery \
	$(ANVIL_NETWORK_ARGS)
	$(MAKE) sync-mobile CHAIN_ID=$(CHAIN_ID_LOCAL) 
	$(MAKE) sync-abi	

.PHONY: deploy-email-local
deploy-email-local: build
	forge script script/DeployEmailRecovery.s.sol:DeployEmailRecovery \
	$(ANVIL_NETWORK_ARGS)
	$(MAKE) sync-mobile CHAIN_ID=$(CHAIN_ID_LOCAL)
	$(MAKE) sync-abi

.PHONY: deploy-sepolia
deploy-sepolia:
	@echo "deploy-sepolia is a compatibility alias for the canonical portable infra flow."
	@echo "For the full Sepolia stack, run make deploy-sepolia then make deploy-email-sepolia."
	$(MAKE) deploy-infra-sepolia PRIVATE_KEY=$(PRIVATE_KEY) ENTRYPOINT=$(ENTRYPOINT)

.PHONY: deploy-email-sepolia
deploy-email-sepolia: build
	@echo "Deploying email recovery after canonical infra deployment on Sepolia."
	forge script script/DeployEmailRecovery.s.sol:DeployEmailRecovery \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--account sepKey \
		--broadcast -vvv

.PHONY: ping-anvil
ping-anvil:
	@echo "Pinging Anvil network at $(ANVIL_RPC_URL) ..."
	cast block-number --rpc-url $(ANVIL_RPC_URL)

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
		--broadcast \
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

.PHONY: deploy-infra-local-portable
deploy-infra-local-portable: build
	$(DEPLOY_SCRIPT_ENV) forge script script/DeployInfraLocalPortable.s.sol:DeployInfraLocalPortable \
		--rpc-url $(RPC_URL) \
		--broadcast \
		$(SCRIPT_VERBOSITY)

.PHONY: validate-local-portable
validate-local-portable:
	@echo "Validating canonical Safe-root infra flow against local Anvil."
	@echo "Note: 31337 is not allowlisted as a portable release chain, so this target skips check-chain-support."
	$(MAKE) check-root-factory RPC_URL=$(LOCAL_PORTABLE_RPC_URL)
	$(MAKE) predict-infra RPC_URL=$(LOCAL_PORTABLE_RPC_URL) ENTRYPOINT=$(ENTRYPOINT)
	$(MAKE) deploy-infra-local-portable RPC_URL=$(LOCAL_PORTABLE_RPC_URL) PRIVATE_KEY=$(LOCAL_PORTABLE_PRIVATE_KEY) ENTRYPOINT=$(ENTRYPOINT)
	$(MAKE) verify-infra RPC_URL=$(LOCAL_PORTABLE_RPC_URL) ENTRYPOINT=$(ENTRYPOINT)

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
	@echo "Syncing artifacts for chain $(CHAIN_ID) to $(MOBILE_DIR)"
	mkdir -p $(MOBILE_DIR)/contracts

	# copy the derived compatibility manifest used by local/mobile flows
	# canonical release truth lives in deployments/releases/* and deployments/chains/*
	cp deployments/$(CHAIN_ID).json \
		$(MOBILE_DIR)/contracts/deployment.$(CHAIN_ID).json

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
