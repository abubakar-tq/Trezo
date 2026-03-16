// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {SocialRecovery, ISocialRecoveryAccount} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {ISocialRecovery} from "src/modules/SocialRecovery/interfaces/ISocialRecovery.sol";
import {PasskeyTypes} from "src/common/Types.sol";

contract MockERC1271Guardian {
    bytes4 internal constant MAGIC = 0x1626ba7e;
    mapping(bytes32 => bool) internal approvals;

    function setSignature(bytes32 digest, bytes calldata signature, bool approved) external {
        approvals[_key(digest, signature)] = approved;
    }

    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4) {
        if (approvals[_key(digest, signature)]) {
            return MAGIC;
        }
        return 0xffffffff;
    }

    function _key(bytes32 digest, bytes calldata signature) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(digest, keccak256(signature)));
    }
}

contract MockSocialRecoveryAccount is ISocialRecoveryAccount {
    mapping(address => bool) private _recoveryModules;
    PasskeyTypes.PasskeyInit private _lastPasskey;
    uint256 public passkeyAddCount;

    function setRecoveryModule(address module, bool enabled) external {
        _recoveryModules[module] = enabled;
    }

    function isRecoveryModule(address module) external view override returns (bool) {
        return _recoveryModules[module];
    }

    function addPasskeyFromRecovery(PasskeyTypes.PasskeyInit calldata newPassKey) external override {
        _lastPasskey = PasskeyTypes.PasskeyInit({
            idRaw: newPassKey.idRaw,
            px: newPassKey.px,
            py: newPassKey.py
        });
        passkeyAddCount += 1;
    }

    function lastPasskey() external view returns (PasskeyTypes.PasskeyInit memory) {
        return _lastPasskey;
    }
}

contract SocialRecoveryTest is Test {
    SocialRecovery internal recovery;
    MockSocialRecoveryAccount internal account;

    uint256 internal guardianKey1 = 0xA11CE;
    uint256 internal guardianKey2 = 0xB0B;
    address internal guardian1;
    address internal guardian2;
    bytes32 private constant PASSKEY_TYPE_HASH =
        keccak256("PasskeyInit(bytes32 idRaw,uint256 px,uint256 py)");
    uint256 private constant TIME_LOCK = 1 days;

    function setUp() public {
        recovery = new SocialRecovery();
        account = new MockSocialRecoveryAccount();

        guardian1 = vm.addr(guardianKey1);
        guardian2 = vm.addr(guardianKey2);

        address[] memory guardians = new address[](2);
        guardians[0] = guardian1;
        guardians[1] = guardian2;

        vm.prank(address(account));
        recovery.onInstall(abi.encode(guardians, uint256(2)));

        account.setRecoveryModule(address(recovery), true);
    }

    function testScheduleRequiresAuthorizedModule() public {
        account.setRecoveryModule(address(recovery), false);

        PasskeyTypes.PasskeyInit memory newPassKey = _makePasskey("seed-authorize");
        ISocialRecovery.GuardianSig[] memory sigs = new ISocialRecovery.GuardianSig[](2);

        vm.expectRevert(SocialRecovery.SocialRecovery_ModuleNotAuthorized.selector);
        recovery.scheduleRecovery(address(account), newPassKey, sigs);
    }

    function testScheduleWithERC1271Guardian() public {
        SocialRecovery newRecovery = new SocialRecovery();
        MockSocialRecoveryAccount newAccount = new MockSocialRecoveryAccount();
        MockERC1271Guardian contractGuardian = new MockERC1271Guardian();

        address[] memory guardians = new address[](2);
        guardians[0] = guardian1;
        guardians[1] = address(contractGuardian);

        vm.prank(address(newAccount));
        newRecovery.onInstall(abi.encode(guardians, uint256(2)));
        newAccount.setRecoveryModule(address(newRecovery), true);

        PasskeyTypes.PasskeyInit memory passkey = _makePasskey("seed-erc1271");
        bytes32 digest = newRecovery.getRecoveryDigest(address(newAccount), 0, passkey);

        bytes memory contractSig = bytes("contract-approval");
        contractGuardian.setSignature(digest, contractSig, true);

        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(guardianKey1, digest);

        ISocialRecovery.GuardianSig[] memory sigs = new ISocialRecovery.GuardianSig[](2);
        sigs[0] = ISocialRecovery.GuardianSig({
            index: 0,
            kind: ISocialRecovery.SigKind.EOA_ECDSA,
            sig: _packSignature(v1, r1, s1)
        });
        sigs[1] = ISocialRecovery.GuardianSig({
            index: 1,
            kind: ISocialRecovery.SigKind.ERC1271,
            sig: contractSig
        });

        vm.prank(guardian1);
        newRecovery.scheduleRecovery(address(newAccount), passkey, sigs);

        vm.warp(block.timestamp + TIME_LOCK + 1);
        newRecovery.executeRecovery(address(newAccount), passkey);

        assertEq(newAccount.passkeyAddCount(), 1, "contract guardian recovery failed");
    }

    function testRecoveryNonceIncrementsAfterSchedule() public {
        assertEq(recovery.getRecoveryNonce(address(account)), 0, "nonce should start at zero");

        PasskeyTypes.PasskeyInit memory newPassKey = _makePasskey("seed-nonce");
        bytes32 digest = _recoveryDigest(address(account), 0, newPassKey);

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
        recovery.scheduleRecovery(address(account), newPassKey, sigs);

        assertEq(recovery.getRecoveryNonce(address(account)), 1, "nonce should increment after scheduling");
    }

    function testScheduleRevertsWhenThresholdNotMet() public {
        PasskeyTypes.PasskeyInit memory newPassKey = _makePasskey("seed-threshold");
        ISocialRecovery.GuardianSig[] memory sigs = new ISocialRecovery.GuardianSig[](1);
        sigs[0] = ISocialRecovery.GuardianSig({
            index: 0,
            kind: ISocialRecovery.SigKind.APPROVE_HASH,
            sig: bytes("")
        });

        vm.expectRevert(SocialRecovery.SocialRecovery_ThresholdMustBeLessThanGuardians.selector);
        recovery.scheduleRecovery(address(account), newPassKey, sigs);
    }

    function testScheduleAndExecuteWithEOASignatures() public {
        PasskeyTypes.PasskeyInit memory newPassKey = _makePasskey("seed-eoa");
        bytes32 digest = _recoveryDigest(address(account), 0, newPassKey);

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

        bytes32 expectedId = keccak256(abi.encode(address(account), _hashPasskey(newPassKey)));

        bytes32 recoveryId = recovery.scheduleRecovery(address(account), newPassKey, sigs);
        assertEq(recoveryId, expectedId, "recovery id mismatch");

        vm.warp(block.timestamp + TIME_LOCK + 1);

        vm.expectEmit(true, true, false, true);
        emit SocialRecovery.RecoveryExecuted(address(account), recoveryId);
        recovery.executeRecovery(address(account), newPassKey);

        assertEq(account.passkeyAddCount(), 1, "passkey not added");
    }

    function testScheduleAndExecuteRecoveryFlow() public {
        PasskeyTypes.PasskeyInit memory newPassKey = _makePasskey("seed-execute");
        bytes32 digest = _recoveryDigest(address(account), 0, newPassKey);

        vm.prank(guardian1);
        recovery.approveHash(digest);
        vm.prank(guardian2);
        recovery.approveHash(digest);

        ISocialRecovery.GuardianSig[] memory sigs = new ISocialRecovery.GuardianSig[](2);
        sigs[0] = ISocialRecovery.GuardianSig({
            index: 0,
            kind: ISocialRecovery.SigKind.APPROVE_HASH,
            sig: bytes("")
        });
        sigs[1] = ISocialRecovery.GuardianSig({
            index: 1,
            kind: ISocialRecovery.SigKind.APPROVE_HASH,
            sig: bytes("")
        });

        bytes32 expectedId = keccak256(abi.encode(address(account), _hashPasskey(newPassKey)));
        uint256 expectedExecuteAfter = block.timestamp + TIME_LOCK;

        vm.expectEmit(true, true, false, true);
        emit SocialRecovery.RecoveryScheduled(address(account), expectedId, expectedExecuteAfter);
        bytes32 recoveryId = recovery.scheduleRecovery(address(account), newPassKey, sigs);

        assertEq(recoveryId, expectedId, "recovery id mismatch");

        vm.expectRevert(
            abi.encodeWithSelector(
                SocialRecovery.SocialRecovery_InvalidRecoveryState.selector,
                recoveryId,
                ISocialRecovery.OperationState.Waiting
            )
        );
        recovery.executeRecovery(address(account), newPassKey);

        vm.warp(block.timestamp + TIME_LOCK + 1);

        vm.expectEmit(true, true, false, true);
        emit SocialRecovery.RecoveryExecuted(address(account), recoveryId);
        recovery.executeRecovery(address(account), newPassKey);

        PasskeyTypes.PasskeyInit memory stored = account.lastPasskey();
        assertEq(account.passkeyAddCount(), 1, "passkey add count");
        assertEq(stored.idRaw, newPassKey.idRaw, "id mismatch");
        assertEq(stored.px, newPassKey.px, "px mismatch");
        assertEq(stored.py, newPassKey.py, "py mismatch");

        vm.expectRevert(SocialRecovery.SocialRecovery_NoActiveRecovery.selector);
        recovery.executeRecovery(address(account), newPassKey);
    }

    function testCancelRecoveryAllowsReschedule() public {
        PasskeyTypes.PasskeyInit memory passkeyOne = _makePasskey("seed-cancel-one");
        bytes32 digestOne = _recoveryDigest(address(account), 0, passkeyOne);

        vm.prank(guardian1);
        recovery.approveHash(digestOne);
        vm.prank(guardian2);
        recovery.approveHash(digestOne);

        ISocialRecovery.GuardianSig[] memory sigs = _approvedSignatures();
        bytes32 firstId = recovery.scheduleRecovery(address(account), passkeyOne, sigs);

        vm.expectEmit(true, true, false, true);
        emit SocialRecovery.RecoveryCancelled(address(account), firstId);
        recovery.cancelRecovery(address(account), firstId);

        vm.expectRevert(SocialRecovery.SocialRecovery_NoActiveRecovery.selector);
        recovery.executeRecovery(address(account), passkeyOne);

        PasskeyTypes.PasskeyInit memory passkeyTwo = _makePasskey("seed-cancel-two");
        bytes32 digestTwo = _recoveryDigest(address(account), 1, passkeyTwo);

        vm.prank(guardian1);
        recovery.approveHash(digestTwo);
        vm.prank(guardian2);
        recovery.approveHash(digestTwo);

        bytes32 secondId = recovery.scheduleRecovery(address(account), passkeyTwo, sigs);
        assertEq(secondId, keccak256(abi.encode(address(account), _hashPasskey(passkeyTwo))), "second id mismatch");
    }

    function _approvedSignatures() internal pure returns (ISocialRecovery.GuardianSig[] memory sigs) {
        sigs = new ISocialRecovery.GuardianSig[](2);
        sigs[0] = ISocialRecovery.GuardianSig({
            index: 0,
            kind: ISocialRecovery.SigKind.APPROVE_HASH,
            sig: bytes("")
        });
        sigs[1] = ISocialRecovery.GuardianSig({
            index: 1,
            kind: ISocialRecovery.SigKind.APPROVE_HASH,
            sig: bytes("")
        });
    }

    function _recoveryDigest(address wallet, uint256 nonce, PasskeyTypes.PasskeyInit memory passkey)
        internal
        view
        returns (bytes32)
    {
        return recovery.getRecoveryDigest(wallet, nonce, passkey);
    }

    function _hashPasskey(PasskeyTypes.PasskeyInit memory passkey) internal pure returns (bytes32) {
        return keccak256(abi.encode(PASSKEY_TYPE_HASH, passkey.idRaw, passkey.px, passkey.py));
    }

    function _makePasskey(bytes32 seed) internal pure returns (PasskeyTypes.PasskeyInit memory) {
        return PasskeyTypes.PasskeyInit({
            idRaw: keccak256(abi.encodePacked(seed, bytes32("id"))),
            px: uint256(keccak256(abi.encodePacked(seed, "px"))),
            py: uint256(keccak256(abi.encodePacked(seed, "py")))
        });
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
