// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";

contract AccountStorageTest is Test {
    error AlreadyInitialized();

    AccountFactory accountFactory;
    address proxy;
    address entryPoint;
    HelperConfig helperConfig;
    PasskeyTypes.PasskeyInit passkeyInit;
    PasskeyValidator passkeyValidator;

    function setUp() public {
        // Use DeployAccount script to get all required contracts
        DeployAccount deployScript = new DeployAccount();
        (
            HelperConfig _helperConfig,
            , // Smart Account
            , // proxy Factory
            AccountFactory _accountFactory,
            PasskeyValidator _passkeyValidator
        ) = deployScript.deployAccount();

        accountFactory = _accountFactory;
        passkeyValidator = _passkeyValidator;
        passkeyInit = PassKeyDemo.getPasskeyInit(1);

        proxy = accountFactory.createAccount(keccak256("user-storage-setup"), address(passkeyValidator), passkeyInit);

        helperConfig = _helperConfig;

        entryPoint = accountFactory.entryPoint();
    }

    /*//////////////////////////////////////////////////////////////
                             SANITY CHECKS
    //////////////////////////////////////////////////////////////*/

    function testSmartAccountStorageIsInitialized() public view {
        // Check storage variables via SmartAccount interface
        bool initialized = SmartAccount(payable(proxy)).getInitialized();

        address storedEntryPoint = SmartAccount(payable(proxy)).getEntryPoint();
        // Assert values
        assertEq(initialized, true, "SmartAccount not initialized");

        assertEq(storedEntryPoint, entryPoint, "EntryPoint not set correctly");
        console2.log("SmartAccount storage initialized and verified");
    }

    function testInitializationTwiceFails() public {
        // Try to initialize again and expect revert
        vm.expectRevert(AlreadyInitialized.selector);
        SmartAccount(payable(proxy)).initialize(entryPoint, address(passkeyValidator), passkeyInit);
        console2.log("Re-initialization correctly reverted");
    }

    function testEntryPointIsSetCorrectly() public {
        // Check entryPoint via SmartAccount interface
        address storedEntryPoint = SmartAccount(payable(proxy)).getEntryPoint();
        // Assert values

        address entryPointFromHelperConfig = helperConfig.getConfig().entryPoint;
        assertEq(storedEntryPoint, entryPoint, "EntryPoint not set correctly");
        assertEq(storedEntryPoint, entryPointFromHelperConfig, "EntryPoint does not match HelperConfig");
        console2.log("SmartAccount entryPoint initialized and verified");
    }
}
