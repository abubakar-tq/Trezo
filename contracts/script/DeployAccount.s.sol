// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {DeployConstants} from "./common/DeployConstants.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

contract DeployAccount is Script {
    error LegacyDeployAccountUnsupportedChain(uint256 chainId);

    uint256 internal constant LEGACY_LOCAL_CHAIN_ID = 31_337;
    address internal constant LEGACY_ROOT_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run()
        external
        returns (
            HelperConfig helperConfig,
            SmartAccount smartAccount,
            MinimalProxyFactory proxyFactory,
            AccountFactory accountFactory,
            PasskeyValidator passkeyValidator,
            SocialRecovery socialRecovery
        )
    {
        return deployAccount();
    }

    function deployAccount()
        public
        returns (
            HelperConfig helperConfig,
            SmartAccount smartAccount,
            MinimalProxyFactory proxyFactory,
            AccountFactory accountFactory,
            PasskeyValidator passkeyValidator,
            SocialRecovery socialRecovery
        )
    {
        _assertLegacyLocalChain();
        console2.log("WARNING: DeployAccount is a legacy local/test fixture.");
        console2.log("WARNING: Use DeployInfra for portable or non-local deployments.");
        console2.log("legacyRootDeployer:", LEGACY_ROOT_DEPLOYER);

        helperConfig = new HelperConfig();

        HelperConfig.NetworkConfig memory networkConfig = helperConfig.getConfig();
        address rootDeployer = deterministicRootDeployer();

        vm.startBroadcast(networkConfig.account);

        smartAccount = new SmartAccount{salt: DeployConstants.SMART_ACCOUNT_IMPL_SALT}();

        address predictedAccountFactory =
            _predictAccountFactory(rootDeployer, address(smartAccount), networkConfig.entryPoint);

        proxyFactory = new MinimalProxyFactory{salt: DeployConstants.MINIMAL_PROXY_FACTORY_SALT}(
            address(smartAccount),
            predictedAccountFactory
        );

        accountFactory = new AccountFactory{salt: DeployConstants.ACCOUNT_FACTORY_SALT}(
            address(smartAccount),
            rootDeployer,
            DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
            networkConfig.entryPoint
        );
        require(address(accountFactory) == predictedAccountFactory, "unexpected AccountFactory address");
        require(address(proxyFactory) == accountFactory.proxyFactory(), "unexpected MinimalProxyFactory address");

        passkeyValidator = new PasskeyValidator{salt: DeployConstants.PASSKEY_VALIDATOR_SALT}();
        socialRecovery = new SocialRecovery{salt: DeployConstants.SOCIAL_RECOVERY_SALT}();

        console2.log("=== DeployAccount ===");
        console2.log("chainId:", block.chainid);
        console2.log("entryPoint:", networkConfig.entryPoint);
        console2.log("SmartAccount impl:", address(smartAccount));
        console2.log("MinimalProxyFactory:", address(proxyFactory));
        console2.log("AccountFactory:", address(accountFactory));
        console2.log("PasskeyValidator:", address(passkeyValidator));
        console2.log("SocialRecovery:", address(socialRecovery));

        _writeDeploymentJson(
            networkConfig,
            smartAccount,
            proxyFactory,
            accountFactory,
            passkeyValidator,
            socialRecovery
        );

        vm.stopBroadcast();

        return (helperConfig, smartAccount, proxyFactory, accountFactory, passkeyValidator, socialRecovery);
    }

    function _predictAccountFactory(address deployer, address smartAccount, address entryPoint)
        internal
        pure
        returns (address)
    {
        bytes memory initCode = abi.encodePacked(
            type(AccountFactory).creationCode,
            abi.encode(smartAccount, deployer, DeployConstants.MINIMAL_PROXY_FACTORY_SALT, entryPoint)
        );
        return Create2.computeAddress(DeployConstants.ACCOUNT_FACTORY_SALT, keccak256(initCode), deployer);
    }

    function _writeDeploymentJson(
        HelperConfig.NetworkConfig memory net,
        SmartAccount smartAccount,
        MinimalProxyFactory proxyFactory,
        AccountFactory accountFactory,
        PasskeyValidator passkeyValidator,
        SocialRecovery socialRecovery
    ) internal {
        string memory root = "root";
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");

        _preserveExistingEmailRecoveryDeployment(root, path);

        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "entryPoint", net.entryPoint);
        vm.serializeAddress(root, "usdc", net.usdc);
        vm.serializeAddress(root, "deployer", net.account);
        vm.serializeString(root, "infraVersion", DeployConstants.TREZO_INFRA_VERSION);
        vm.serializeAddress(root, "rootFactory", deterministicRootDeployer());
        vm.serializeBool(root, "portable", DeployConstants.isPortableChain(block.chainid));

        vm.serializeAddress(root, "smartAccountImpl", address(smartAccount));
        vm.serializeAddress(root, "proxyFactory", address(proxyFactory));
        vm.serializeAddress(root, "accountFactory", address(accountFactory));
        vm.serializeAddress(root, "passkeyValidator", address(passkeyValidator));
        vm.serializeAddress(root, "socialRecovery", address(socialRecovery));

        string memory json = vm.serializeBool(root, "success", true);

        vm.writeJson(json, path);

        console2.log("Deployment JSON written:", path);
    }

    function _preserveExistingEmailRecoveryDeployment(string memory root, string memory path) internal {
        try vm.readFile(path) returns (string memory existingJson) {
            _trySerializeExistingAddress(root, "emailRecovery", existingJson, ".emailRecovery");
            _trySerializeExistingAddress(
                root,
                "emailRecoveryCommandHandler",
                existingJson,
                ".emailRecoveryCommandHandler"
            );
            _trySerializeExistingAddress(root, "zkEmailVerifier", existingJson, ".zkEmailVerifier");
            _trySerializeExistingAddress(
                root,
                "zkEmailDkimRegistry",
                existingJson,
                ".zkEmailDkimRegistry"
            );
            _trySerializeExistingAddress(root, "zkEmailAuthImpl", existingJson, ".zkEmailAuthImpl");
            _trySerializeExistingAddress(
                root,
                "zkEmailGroth16Verifier",
                existingJson,
                ".zkEmailGroth16Verifier"
            );
            _trySerializeExistingAddress(
                root,
                "zkEmailVerifierImpl",
                existingJson,
                ".zkEmailVerifierImpl"
            );
            _trySerializeExistingAddress(
                root,
                "zkEmailDkimRegistryImpl",
                existingJson,
                ".zkEmailDkimRegistryImpl"
            );
            _trySerializeExistingAddress(
                root,
                "emailRecoveryKillSwitchAuthorizer",
                existingJson,
                ".emailRecoveryKillSwitchAuthorizer"
            );
            _trySerializeExistingUint(
                root,
                "emailRecoveryMinimumDelay",
                existingJson,
                ".emailRecoveryMinimumDelay"
            );
        } catch { }
    }

    function _trySerializeExistingAddress(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    )
        internal
    {
        try vm.parseJsonAddress(existingJson, jsonPath) returns (address value) {
            vm.serializeAddress(root, key, value);
        } catch { }
    }

    function _trySerializeExistingUint(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    )
        internal
    {
        try vm.parseJsonUint(existingJson, jsonPath) returns (uint256 value) {
            vm.serializeUint(root, key, value);
        } catch { }
    }

    function deterministicRootDeployer() internal pure returns (address) {
        return LEGACY_ROOT_DEPLOYER;
    }

    function _assertLegacyLocalChain() internal {
        if (block.chainid != LEGACY_LOCAL_CHAIN_ID) {
            console2.log("DeployAccount is a legacy local/test fixture.");
            console2.log("Use DeployInfra for portable or non-local deployments.");
            revert LegacyDeployAccountUnsupportedChain(block.chainid);
        }
    }
}
