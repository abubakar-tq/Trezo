// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
contract MinimalTest is Test {

    SmartAccount implementation;
    MinimalProxyFactory factory;
    address proxy;
    AccountFactory accountFactory;
    HelperConfig helperConfig;
    PasskeyValidator passkeyValidator;
    SendPackedUserOp sendUserOp;

    function setUp() public {
        DeployAccount deployer = new DeployAccount();
        (helperConfig, implementation,  factory, accountFactory,passkeyValidator, ) = deployer.deployAccount();


        proxy = accountFactory.createAccount(keccak256("user1"), address(passkeyValidator), PassKeyDemo.getPasskeyInit(0));
        sendUserOp = new SendPackedUserOp();
        
        console2.log("Setup complete");
    }

    function testProxyDelegation() public {
       
        // Verify proxy address is not zero
        assert(proxy != address(0));
      
        (bool ok, bytes memory ret) = proxy.call(abi.encodeWithSelector(SmartAccount.ping.selector));
        require(ok, "Delegatecall failed");
        (bytes32 who) = abi.decode(ret, (bytes32));
        assert(who != bytes32(0));
    }

    
    function testTransferWithPassKey() public {
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();

        address target = makeAddr("target2");
        uint256 value = 0.05 ether;

        bytes memory functionData = "";
        bytes memory callData = abi.encodeWithSelector(
            SmartAccount.execute.selector,
            target,
            value,
            functionData
        );

        PackedUserOperation memory userOp = sendUserOp.generatePasskeySignedUserOperation(
            callData,
            config,
            proxy,
            0
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.deal(proxy, 1 ether);

        address bundler = makeAddr("bundler");
        vm.deal(bundler, 1 ether);
        vm.startPrank(bundler);
        IEntryPoint(config.entryPoint).handleOps(ops, payable(bundler));
        vm.stopPrank();

        assertEq(target.balance, value, "target should receive transferred value");
    }
}
