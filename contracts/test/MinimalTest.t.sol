// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BeaconAwareProxy} from "src/proxy/BeaconAwareProxy.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountBeacon} from "src/proxy/AccountBeacon.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

contract MinimalTest is Test {
    AccountBeacon beacon;
    SmartAccount implementation;
    MinimalProxyFactory factory;
    address proxy;
    AccountFactory accountFactory;

    function setUp() public {
        // Deploy SmartAccount implementation
        implementation = new SmartAccount();
        // Deploy AccountBeacon pointing to SmartAccount
        beacon = new AccountBeacon(address(implementation));
        // Deploy MinimalProxyFactory with BeaconAwareProxy as template
        BeaconAwareProxy template = new BeaconAwareProxy(address(beacon), "");
        factory = new MinimalProxyFactory(address(template));

        accountFactory = new AccountFactory(address(beacon), address(factory));
    }

    function testProxyDelegation() public {
        // // Prepare init calldata for SmartAccount.initialize(owner, value)
        // bytes memory initCalldata = abi.encodeWithSelector(SmartAccount.initialize.selector, address(this));
        // Deploy proxy via Account Factory
        proxy = accountFactory.createAccount(address(this), keccak256("user1"));
        console2.log("Account created successfully");
        // Verify proxy address is not zero
        assert(proxy != address(0));
        // Verify implementation address via beacon
        address impl = AccountBeacon(beacon).implementation();
        assert(impl == address(implementation));
        // //check address of beacon
        address beaconAddr = BeaconAwareProxy(payable(proxy)).getBeacon();

        console2.log("Beacon address fetched successfully");

        assert(address(beacon) == beaconAddr);
        
        // Interact with proxy (delegatecall to SmartAccount)
        (bool ok, bytes memory ret) = proxy.call(abi.encodeWithSelector(SmartAccount.ping.selector));
        require(ok, "Delegatecall failed");
        (bytes32 who, address owner) = abi.decode(ret, (bytes32, address));
        // Verify delegatecall returned expected values
        assert(owner == address(this));
        assert(who != bytes32(0));
    }
}
