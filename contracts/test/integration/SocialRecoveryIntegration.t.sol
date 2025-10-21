// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";

import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.s.sol";
import {ISocialRecovery} from "src/modules/SocialRecovery/interfaces/ISocialRecovery.sol";

import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";

contract SocialRecoveryIntegrationTest is Test {
    AccountFactory internal accountFactory;
    PasskeyValidator internal passkeyValidator;
    HelperConfig internal helperConfig;
    HelperConfig.NetworkConfig internal config;
    SendPackedUserOp internal sendUserOp;
    SocialRecovery internal recoveryModule;

    address internal proxy;
    address internal entryPoint;
    address internal bundler;

    uint256 internal constant TIME_LOCK = 1 days;

    uint256 internal guardianKey1 = 0x111111;
    uint256 internal guardianKey2 = 0x222222;
    address internal guardian1;
    address internal guardian2;

    address internal spender = makeAddr("spender");

    function setUp() public {
        DeployAccount deployScript = new DeployAccount();
        (
            HelperConfig _helperConfig,
            ,
            ,
            AccountFactory _accountFactory,
            PasskeyValidator _passkeyValidator
        ) = deployScript.deployAccount();
        helperConfig = _helperConfig;
        accountFactory = _accountFactory;
        passkeyValidator = _passkeyValidator;

        config = helperConfig.getConfig();
        entryPoint = config.entryPoint;
        sendUserOp = new SendPackedUserOp();
        recoveryModule = new SocialRecovery();

        proxy = accountFactory.createAccount(
            keccak256("integration-social-recovery"), address(passkeyValidator), PassKeyDemo.getPasskeyInit(0)
        );

        bundler = makeAddr("bundler");
        guardian1 = vm.addr(guardianKey1);
        guardian2 = vm.addr(guardianKey2);

        _installSocialRecoveryModule();
    }

    function testSocialRecoveryEndToEnd() public {
        // initial validator state
        assertEq(passkeyValidator.passkeyCount(proxy), 1, "expected single passkey after deployment");

        PasskeyTypes.PasskeyInit memory recoveredPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 digest = recoveryModule.getRecoveryDigest(proxy, 0, recoveredPasskey);

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(guardianKey1, digest);
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(guardianKey2, digest);

        ISocialRecovery.GuardianSig[] memory sigs = new ISocialRecovery.GuardianSig[](2);
        sigs[0] = ISocialRecovery.GuardianSig({
            index: 0,
            kind: ISocialRecovery.SigKind.EOA_ECDSA,
            sig: _packSignature(v1, r1, s1)
        });
        sigs[1] = ISocialRecovery.GuardianSig({
            index: 1,
            kind: ISocialRecovery.SigKind.EOA_ECDSA,
            sig: _packSignature(v2, r2, s2)
        });

        vm.prank(guardian1);
        bytes32 recoveryId = recoveryModule.scheduleRecovery(proxy, recoveredPasskey, sigs);
        assertTrue(recoveryId != bytes32(0), "recovery id should be set");

        vm.warp(block.timestamp + TIME_LOCK + 1);
        vm.prank(guardian2);
        recoveryModule.executeRecovery(proxy, recoveredPasskey);

        // Passkey validator should now have two keys registered
        assertEq(passkeyValidator.passkeyCount(proxy), 2, "passkey count not incremented");
        assertTrue(
            passkeyValidator.hasPasskey(proxy, PasskeyValidator.PasskeyId.wrap(recoveredPasskey.idRaw)),
            "missing recovered passkey"
        );

        // New passkey should be able to sign a user operation
        _sendUserOperationWithPasskey(1, PassKeyDemo.getPasskeyPrivateKey(1));

        uint256 allowance = IERC20(config.usdc).allowance(proxy, spender);
        assertEq(allowance, 1e18, "user operation did not execute through new passkey");
    }

    function _installSocialRecoveryModule() internal {
        address[] memory guardians = new address[](2);
        guardians[0] = guardian1;
        guardians[1] = guardian2;
        bytes memory initData = abi.encode(guardians, uint256(2));

        bytes memory functionData =
            abi.encodeWithSelector(SmartAccount.installModule.selector, 2, address(recoveryModule), initData);
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount.execute.selector, proxy, 0, functionData);

        PackedUserOperation memory userOp =
            sendUserOp.generatePasskeySignedUserOperation(executeCalldata, config, proxy, 0);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.deal(payable(proxy), 2 ether);
        vm.deal(bundler, 2 ether);

        vm.prank(bundler);
        IEntryPoint(entryPoint).handleOps(ops, payable(bundler));

        assertTrue(
            SmartAccount(payable(proxy)).isRecoveryModule(address(recoveryModule)),
            "recovery module not enabled"
        );
    }

    function _sendUserOperationWithPasskey(uint256 passkeyIndex, bytes32 passkeyPrivateKey) internal {
        bytes memory functionData = abi.encodeWithSelector(IERC20(config.usdc).approve.selector, spender, 1e18);
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount.execute.selector, config.usdc, 0, functionData);

        PackedUserOperation memory userOp = sendUserOp.generatePasskeySignedUserOperation(
            executeCalldata, config, proxy, passkeyIndex, 1, true, passkeyPrivateKey
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.deal(payable(proxy), 2 ether);
        vm.deal(bundler, 2 ether);
        vm.prank(bundler);
        IEntryPoint(entryPoint).handleOps(ops, payable(bundler));
    }

    function _packSignature(uint8 v, bytes32 r, bytes32 s) internal pure returns (bytes memory sig) {
        if (v < 27) {
            v += 27;
        }
        sig = new bytes(65);
        assembly {
            mstore(add(sig, 0x20), r)
            mstore(add(sig, 0x40), s)
            mstore8(add(sig, 0x60), v)
        }
    }
}
