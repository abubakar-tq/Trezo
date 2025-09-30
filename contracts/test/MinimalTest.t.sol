// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BeaconAwareProxy} from "src/proxy/BeaconAwareProxy.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountBeacon} from "src/proxy/AccountBeacon.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";


contract MinimalTest is Test {
    AccountBeacon beacon;
    SmartAccount implementation;
    MinimalProxyFactory factory;
    address proxy;
    AccountFactory accountFactory;
    HelperConfig helperConfig;
    


    function setUp() public {

        BeaconAwareProxy beaconProxy;
        DeployAccount deployer = new DeployAccount();
        (helperConfig, implementation, beacon, beaconProxy, factory, accountFactory) = deployer.deployAccount();
        proxy = address(beaconProxy);
        console2.log("Setup complete");

    }

    function testProxyDelegation() public {
        // // Prepare init calldata for SmartAccount.initialize(owner, value)
        // bytes memory initCalldata = abi.encodeWithSelector(SmartAccount.initialize.selector, address(this));
        // Deploy proxy via Account Factory
        proxy = accountFactory.createAccount(keccak256("user1"));
        console2.log("Account created successfully");
        // Verify proxy address is not zero
        assert(proxy != address(0));
        // Verify implementation address via beacon
        address impl = AccountBeacon(beacon).implementation();
        assert(impl == address(implementation));
        // //check address of beacon
        // (bool success, bytes memory returndata) = proxy.call{gas: 50000}(abi.encodeWithSignature("_getBeacon()"));
        // require(success, "call failed");
        // console2.log("Beacon address fetched successfully");

        // address beaconAddr = abi.decode(returndata, (address));
        // assert(address(beacon) == beaconAddr);
        // Interact with proxy (delegatecall to SmartAccount)
        (bool ok, bytes memory ret) = proxy.call(abi.encodeWithSelector(SmartAccount.ping.selector));
        require(ok, "Delegatecall failed");
        (bytes32 who) = abi.decode(ret, (bytes32));
        assert(who != bytes32(0));
    }

}
