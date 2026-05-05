// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {console2} from "forge-std/Test.sol";
import {AccountFactoryTestHelper} from "test/helpers/AccountFactoryTestHelper.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";

contract UserOperationTest is AccountFactoryTestHelper {
    AccountFactory accountFactory;
    HelperConfig helperConfig;
    address usdc;
    address entryPoint;
    SendPackedUserOp sendScript;
    HelperConfig.NetworkConfig config;
    address proxy;
    address immutable RANDOM_USER = makeAddr("RandomUser");

    function setUp() public {
        (
            HelperConfig _helperConfig,
            , // smartAccount
            , // proxyFactory
            AccountFactory _accountFactory,
            PasskeyValidator _passkeyValidator,
        ) = _deployAccountStack();
        accountFactory = _accountFactory;
        helperConfig = _helperConfig;
        usdc = helperConfig.getConfig().usdc;
        entryPoint = helperConfig.getConfig().entryPoint;

        sendScript = new SendPackedUserOp();
        config = helperConfig.getConfig();

        proxy = _createAuthorizedAccount(
            accountFactory,
            keccak256("userop-setup"),
            0,
            address(_passkeyValidator),
            PassKeyDemo.getPasskeyInit(0)
        );
    }

    function testSendUserOpAndApproveUSDC() public {
        // Prepare approve calldata for USDC

        bytes memory functionData = abi.encodeWithSelector(IERC20(usdc).approve.selector, RANDOM_USER, 1e18);
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount(payable(proxy)).execute.selector, usdc, 0, functionData);

        PackedUserOperation memory signedUserOp = sendScript.generatePasskeySignedUserOperation(
            executeCalldata, config, proxy, 0, 1, true, PassKeyDemo.getPasskeyPrivateKey(0)
        );

        // Simulate sending userOp to entryPoint
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = signedUserOp;
        vm.deal(payable(proxy), 2 ether);

        //validate for original user
        vm.startPrank(RANDOM_USER);
        IEntryPoint(entryPoint).handleOps(ops, payable(RANDOM_USER));
        vm.stopPrank();
    }

    function testNonOwnerCantSendUserOps() external {
        bytes memory functionData = abi.encodeWithSelector(IERC20(usdc).approve.selector, RANDOM_USER, 1e18);
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount(payable(proxy)).execute.selector, usdc, 0, functionData);

        //Malicious user trying to send bad user operation
        // Noone other than owner should be able to sign and execute user
        PackedUserOperation memory badUserOp = sendScript.generatePasskeySignedUserOperation(
            executeCalldata, config, proxy, 0, 1, true, PassKeyDemo.getPasskeyPrivateKey(1)
        );

        vm.deal(payable(proxy), 2 ether);
        PackedUserOperation[] memory badOps = new PackedUserOperation[](1);
        badOps[0] = badUserOp;
        vm.expectRevert();
        IEntryPoint(entryPoint).handleOps(badOps, payable(RANDOM_USER));

        // Check USDC approval
        uint256 allowance = IERC20(usdc).allowance(proxy, RANDOM_USER);
        assertEq(allowance, 0, "USDC not approved correctly");
    }
}
