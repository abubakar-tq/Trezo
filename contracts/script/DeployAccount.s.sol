// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountBeacon} from "src/proxy/AccountBeacon.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {BeaconAwareProxy} from "src/proxy/BeaconAwareProxy.sol";

contract DeployAccount is Script {
    function run()
        external
        returns (
            HelperConfig helperConfig,
            SmartAccount smartAccount,
            AccountBeacon beacon,
            BeaconAwareProxy proxy,
            MinimalProxyFactory proxyFactory,
            AccountFactory accountFactory
        )
    {
        return deployAccount();
    }

    function deployAccount()
        public
        returns (
            HelperConfig helperConfig,
            SmartAccount smartAccount,
            AccountBeacon beacon,
            BeaconAwareProxy proxy,
            MinimalProxyFactory proxyFactory,
            AccountFactory accountFactory
        )
    {
        helperConfig = new HelperConfig();

        HelperConfig.NetworkConfig memory networkConfig = helperConfig.getConfig();

        vm.startBroadcast(networkConfig.account);

        smartAccount = new SmartAccount();
        smartAccount.initialize(networkConfig.entryPoint);

        beacon = new AccountBeacon(address(smartAccount));
        proxy = new BeaconAwareProxy(address(beacon), "");
        proxyFactory = new MinimalProxyFactory(address(proxy));
        accountFactory = new AccountFactory(address(beacon), address(proxyFactory), networkConfig.entryPoint);

        vm.stopBroadcast();

        return (helperConfig, smartAccount, beacon, proxy, proxyFactory, accountFactory);
    }
}
