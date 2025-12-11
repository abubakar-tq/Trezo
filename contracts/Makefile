-include .env
# trezo/contracts/Makefile

DEFAULT_ANVIL_KEY := 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

DEFAULT_ANVIL_ACCOUNT := 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Where the Expo app lives (relative to contracts/)
MOBILE_DIR ?= ../apps/mobile/src/integration


# Chain IDs (must match the actual networks)
CHAIN_ID_LOCAL    ?= 31337
CHAIN_ID_SEPOLIA  ?= 11155111


ANVIL_NETWORK_ARGS := --rpc-url http://localhost:8545 --private-key $(DEFAULT_ANVIL_KEY) --broadcast -vvvv

.PHONY: build
build:
	forge build

# ---------- Deploy targets ----------

.PHONY: deploy-local
deploy-local: build
	forge script script/DeployAccount.s.sol:DeployAccount \
	$(ANVIL_NETWORK_ARGS)
	$(MAKE) sync-mobile CHAIN_ID=$(CHAIN_ID_LOCAL)

.PHONY: deploy-sepolia
deploy-sepolia: build
	forge script script/DeployAccount.s.sol:DeployAccount \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--account sepKey \
		--broadcast -vvv

# ---------- Sync artifacts to mobile ----------

# Needs: jq installed
.PHONY: sync-mobile
sync-mobile:
	@echo "Syncing artifacts for chain $(CHAIN_ID) to $(MOBILE_DIR)"
	mkdir -p $(MOBILE_DIR)/contracts

	# copy deployment JSON (written by DeployAccount.s.sol as deployments/<chainId>.json)
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
