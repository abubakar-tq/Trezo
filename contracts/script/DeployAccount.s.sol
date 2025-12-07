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

        // deployments/31337.json, deployments/11155111.json, ...
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console2.log("Deployment JSON written:", path);
    }
}
