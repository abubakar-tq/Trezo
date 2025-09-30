// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AccountBeacon} from "src/proxy/AccountBeacon.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {BeaconAwareProxy} from "src/proxy/BeaconAwareProxy.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";

contract AccountStorageTest is Test {
     error AlreadyInitialized();


    AccountFactory accountFactory;
    address proxy;
    address entryPoint;
    HelperConfig helperCofig;
    



    function setUp() public {
        // Use DeployAccount script to get all required contracts
        DeployAccount deployScript = new DeployAccount();
        (
            HelperConfig _helperConfig, // helperConfig
            , // smartAccount
            , // beacon
            BeaconAwareProxy _proxy, // proxy
            , // proxyFactory
            AccountFactory _accountFactory
        ) = deployScript.deployAccount();

        accountFactory = _accountFactory;
        proxy = address(_proxy);
        helperCofig=_helperConfig;

        // entryPoint = helperConfig.getConfig().entryPoint;

        entryPoint = accountFactory.entryPoint();
    }

    /*//////////////////////////////////////////////////////////////
                             SANITY CHECKS
    //////////////////////////////////////////////////////////////*/

    function testSmartAccountStorageIsInitialized() public { 
        bytes32 salt = keccak256("user-storage-test");
        // Deploy proxy via AccountFactory
        proxy = accountFactory.createAccount( salt);
        // Check storage variables via SmartAccount interface
        bool initialized = SmartAccount(payable(proxy)).getInitialized();
       
        address storedEntryPoint = SmartAccount(payable(proxy)).getEntryPoint();
        // Assert values
        assertEq(initialized,true,"SmartAccount not initialized");
       
        assertEq(storedEntryPoint, entryPoint, "EntryPoint not set correctly");
        console2.log("SmartAccount storage initialized and verified");
    }

    function testInitializationTwiceFails() public {
        bytes32 salt = keccak256("user-storage-test-2");
        // Deploy proxy via AccountFactory
        proxy = accountFactory.createAccount(salt);
        // Try to initialize again and expect revert
        vm.expectRevert(AlreadyInitialized.selector);
        SmartAccount(payable(proxy)).initialize(entryPoint);
        console2.log("Re-initialization correctly reverted");
    }

    function testEntryPointIsSetCorrectly() public {
        bytes32 salt = keccak256("user-storage-test-3");
        // Deploy proxy via AccountFactory
        proxy = accountFactory.createAccount(salt);
        // Check entryPoint via SmartAccount interface
        address storedEntryPoint = SmartAccount(payable(proxy)).getEntryPoint();
        // Assert values

        address entryPointFromHelperConfig= helperCofig.getConfig().entryPoint;
        assertEq(storedEntryPoint, entryPoint, "EntryPoint not set correctly");
        assertEq(storedEntryPoint, entryPointFromHelperConfig, "EntryPoint does not match HelperConfig");
        console2.log("SmartAccount entryPoint initialized and verified");
    }


    


}
