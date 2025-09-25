// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Test } from "forge-std/Test.sol";
import {
    RhinestoneModuleKit,
    ModuleKitHelpers,
    AccountInstance,
    UserOpData
} from "lib/modulekit/src/ModuleKit.sol";

import { MODULE_TYPE_VALIDATOR } from "lib/modulekit/src/accounts/kernel/types/Constants.sol";
import { PasskeyValidator } from "src/modules/passkey/PasskeyValidator.sol";


contract PasskeyValidatorTest is RhinestoneModuleKit, Test {
       using ModuleKitHelpers for *;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
       
    PasskeyValidator internal validator;
    AccountInstance internal instance;


    Account owner1;
    Account owner2;

    function setUp() public {
        init();

        // Create the validator
        validator = new PasskeyValidator();
        vm.label(address(validator), "PasskeyValidator");

        // Create the owners
        owner1 = makeAccount("owner1");
        owner2 = makeAccount("owner2");

        // Create the account and install the validator
        instance = makeAccountInstance("PasskeyValidator");
        vm.deal(address(instance.account), 10 ether);

        // Install PasskeyValidator with a dummy passkey
        // Data encoding expected by onInstall:
        // abi.encode(bytes32 idRaw, uint256 px, uint256 py, bytes32 rpIdHash)
        bytes32 dummyId = keccak256("dummy-passkey-id");
        uint256 px = uint256(keccak256("px"));
        uint256 py = uint256(keccak256("py"));
        bytes32 rpIdHash = keccak256("example.com");
        instance.installModule({
            moduleTypeId: MODULE_TYPE_VALIDATOR,
            module: address(validator),
            data: abi.encode(dummyId, px, py, rpIdHash)
        });
    }
    function test_exec_simple_value_transfer_with_userop() public {
        // Arrange: target EOA to receive ether
        address target = makeAddr("target");
        uint256 startBal = target.balance;
        uint256 value = 0.1 ether;

        // Build UserOp for a simple value transfer using the default validator for 4337 sigs
        // (PasskeyValidator is installed but we are not using it for 4337 here)
        UserOpData memory userOpData = instance.getExecOps({
            target: target,
            value: value,
            callData: "",
            txValidator: address(instance.PasskeyValidator) // not actually used in this test
        });

        // Sign with ModuleKit default signature (MockValidator) and execute via EntryPoint
        userOpData = userOpData.signDefault();
        userOpData.execUserOps();

        // Assert: target received funds
        assertEq(target.balance, startBal + value, "target should receive value");
    }
}
