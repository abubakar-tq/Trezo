// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
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
            PasskeyValidator passkeyValidator
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
            PasskeyValidator passkeyValidator
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

        vm.stopBroadcast();

        return (helperConfig, smartAccount, proxyFactory, accountFactory, passkeyValidator);
    }
}
