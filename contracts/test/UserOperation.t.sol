// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract UserOperationTest is Test {
    AccountFactory accountFactory;
    HelperConfig helperConfig;
    address usdc;
    address entryPoint;
    address owner;
    address proxy;
    address immutable RANDOM_USER= makeAddr("RandomUser");

    function setUp() public {
        // Use DeployAccount script to get all required contracts
        DeployAccount deployScript = new DeployAccount();
        (
            HelperConfig _helperConfig,
            , // smartAccount
            , // beacon
            , // proxy
            , // proxyFactory
            AccountFactory _accountFactory
        ) = deployScript.deployAccount();
        accountFactory = _accountFactory;
        helperConfig = _helperConfig;
        usdc = helperConfig.getConfig().usdc;
        entryPoint = helperConfig.getConfig().entryPoint;
        owner = helperConfig.getConfig().account;
    }

    function testSendUserOpAndApproveUSDC() public {
        bytes32 salt = keccak256("userop-test");
        // Deploy proxy via AccountFactory
        proxy = accountFactory.createAccount(owner, salt);
        // Prepare approve calldata for USDC
        
        bytes memory functionData = abi.encodeWithSelector(IERC20(usdc).approve.selector, RANDOM_USER, 1e18);
        bytes memory executeCalldata = abi.encodeWithSelector(SmartAccount(payable(proxy)).execute.selector, usdc, 0, functionData);
        // Use SendPackedUserOp to generate signed user operation
        SendPackedUserOp sendScript = new SendPackedUserOp();
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        PackedUserOperation memory userOp = sendScript.generateSignedUserOperation(executeCalldata, config, proxy);
        // Simulate sending userOp to entryPoint
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;
        vm.deal(payable(proxy), 2 ether); 


        //Malicious user trying to send bad user operation
        // Noone other than owner should be able to sign and execute user
        PackedUserOperation memory badUserOp = sendScript.generateSignedUserOperation(executeCalldata, config, proxy);
        bytes32 badDigest = IEntryPoint(entryPoint).getUserOpHash(badUserOp);
        (uint8 bv, bytes32 br, bytes32 bs) = vm.sign(0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6, badDigest); // random non-owner key
        badUserOp.signature = abi.encodePacked(br, bs, bv);
        PackedUserOperation[] memory badOps = new PackedUserOperation[](1);
        badOps[0] = badUserOp;
        vm.expectRevert();
        IEntryPoint(entryPoint).handleOps(badOps, payable(RANDOM_USER));
        


        //validate for original user
        vm.startPrank(RANDOM_USER);
        IEntryPoint(entryPoint).handleOps(ops, payable(RANDOM_USER));
        vm.stopPrank();

        // Check USDC approval
        uint256 allowance = IERC20(usdc).allowance(proxy, RANDOM_USER);
        assertEq(allowance, 1e18, "USDC not approved correctly");
        console2.log("USDC approved for approver via user operation");
    }


    
}
