// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

contract DeployAccount is Script {
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
        helperConfig = new HelperConfig();

        HelperConfig.NetworkConfig memory networkConfig = helperConfig.getConfig();

        vm.startBroadcast(networkConfig.account);

        // Deploy implementation (SmartAccount) - do not initialize here
        smartAccount = new SmartAccount();

        // Deploy proxy factory using proxy template
        proxyFactory = new MinimalProxyFactory(address(smartAccount));

        // Deploy account factory
        accountFactory = new AccountFactory(address(proxyFactory), networkConfig.entryPoint);

        passkeyValidator = new PasskeyValidator();

        socialRecovery = new SocialRecovery();

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

        vm.serializeAddress(root, "smartAccountImpl", address(smartAccount));
        vm.serializeAddress(root, "proxyFactory", address(proxyFactory));
        vm.serializeAddress(root, "accountFactory", address(accountFactory));
        vm.serializeAddress(root, "passkeyValidator", address(passkeyValidator));
        vm.serializeAddress(root, "socialRecovery", address(socialRecovery));

        string memory json = vm.serializeBool(root, "success", true);

        vm.writeJson(json, path);

        console2.log("Deployment JSON written:", path);
    }

    function _preserveExistingEmailRecoveryDeployment(string memory root, string memory path)
        internal
    {
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
}
