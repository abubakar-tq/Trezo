// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {RhinestoneModuleKit, ModuleKitHelpers, AccountInstance, UserOpData} from "lib/modulekit/src/ModuleKit.sol";

import {MODULE_TYPE_VALIDATOR} from "lib/modulekit/src/accounts/kernel/types/Constants.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {WebAuthnHelper} from "src/utils/WebAuthnHelper.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {P256Signer} from "script/P256Signer.s.sol";


contract PasskeyValidatorTest is RhinestoneModuleKit, Test {
    using ModuleKitHelpers for *;

    modifier skipAnvil() {
        if (block.chainid == 31337) return;
        else _;
    }

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    PasskeyValidator internal validator;
    AccountInstance internal instance;
    SendPackedUserOp internal sendUserOp;
    HelperConfig internal helperConfig;

    Account owner1;
    Account owner2;

    bytes32 internal dummyId;
    bytes32 internal rpHash;

    uint256 internal px;
    uint256 internal py;
    uint256 internal passkeyPrivateKey;

    P256Signer internal signer;

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

        // Install PasskeyValidator with a passkey
        // Data encoding expected by onInstall:
        // abi.encode(bytes32 idRaw, uint256 px, uint256 py)
        PassKeyDemo.PasskeyCredential memory passkey = PassKeyDemo.getPasskey(1);
        dummyId = passkey.init.idRaw;
        px = passkey.init.px;
        py = passkey.init.py;
        rpHash = PassKeyDemo.getPasskeyRpHash(1);
        passkeyPrivateKey = uint256(passkey.privateKey);
        instance.installModule({
            moduleTypeId: MODULE_TYPE_VALIDATOR,
            module: address(validator),
            data: abi.encode(dummyId, px, py)
        });

        helperConfig = new HelperConfig();
        sendUserOp = new SendPackedUserOp();
        signer = new P256Signer();
    }
    /**
     * @notice Build WebAuthn inputs and log the message hash to sign with P-256.
     * @dev Use the printed msgHash to produce r,s off-chain. This test does not execute.
     */

    function test_webauthn_build_and_log_message_hash() public {
        address target = makeAddr("target2");
        uint256 value = 0.05 ether;

        UserOpData memory userOpData =
            instance.getExecOps({target: target, value: value, callData: "", txValidator: address(validator)});

        bytes memory ad = WebAuthnHelper.buildAuthenticatorData(rpHash, true, 1);
        (string memory cjson, uint256 cIdx, uint256 tIdx) =
            WebAuthnHelper.buildClientDataJSONAndIndices(userOpData.userOpHash);
        bytes32 msgHash = WebAuthnHelper.webAuthnMessageHash(ad, cjson);

        console2.log("Passkey msgHash");
        console2.logBytes32(msgHash);
        console2.log("clientDataJSON");
        console2.logString(cjson);
        console2.log("challengeIndex");
        console2.logUint(cIdx);
        console2.log("typeIndex");
        console2.logUint(tIdx);

        assertTrue(msgHash != bytes32(0), "message hash must be non-zero");
    }

    /**
     * @notice Execute with PasskeyValidator using off-chain P-256 r,s pasted below.
     * @dev If r or s are zero, the test will skip execution to keep CI passing.
     */
    function test_exec_with_passkey_external_signature() public {
        address target = makeAddr("target2");
        uint256 startBal = target.balance;
        uint256 value = 0.05 ether;

        UserOpData memory userOpData =
            instance.getExecOps({target: target, value: value, callData: "", txValidator: address(validator)});

        bytes memory ad = WebAuthnHelper.buildAuthenticatorData(rpHash, true, 1);
        (string memory cjson, uint256 cIdx, uint256 tIdx) =
            WebAuthnHelper.buildClientDataJSONAndIndices(userOpData.userOpHash);
        bytes32 msgHash = WebAuthnHelper.webAuthnMessageHash(ad, cjson);

        // HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        (uint256 r, uint256 s) = signer.signDigestWithNonce(msgHash, uint256(PassKeyDemo.getPasskeyPrivateKey(1)), 0);

        bytes memory sig = WebAuthnHelper.encodePasskeySignature(dummyId, ad, cjson, cIdx, tIdx, r, s);

        userOpData.userOp.signature = sig;
        userOpData.execUserOps();

        assertEq(target.balance, startBal + value, "target2 should receive value");
    }

    struct SignatureComponents {
        bytes authenticatorData;
        string clientDataJSON;
        uint256 challengeIndex;
        uint256 typeIndex;
        uint256 r;
        uint256 s;
    }

    function test_is_initialized_and_counts_passkeys() public view {
        // Arrange
        address account = instance.account;

        // Act
        bool initialized = validator.isInitialized(account);
        uint256 count = validator.passkeyCount(account);

        // Assert
        assertTrue(initialized, "validator should be initialized after install");
        assertEq(count, 1, "exactly one passkey expected after install");
    }

    function test_add_passkey_allows_multiple_keys() public {
        // Arrange
        PassKeyDemo.PasskeyCredential memory additional = PassKeyDemo.getPasskey(0);

        // Act
        vm.expectEmit(true, true, false, false);
        emit PasskeyValidator.PasskeyAdded(instance.account, additional.init.idRaw);
        vm.prank(instance.account);
        validator.addPasskey(additional.init.idRaw, additional.init.px, additional.init.py);

        uint256 count = validator.passkeyCount(instance.account);

        // Assert
        assertEq(count, 2, "adding a second passkey should increase count");
    }

    function test_add_passkey_reverts_on_duplicate_id() public {
        // Arrange
        PassKeyDemo.PasskeyCredential memory existing = PassKeyDemo.getPasskey(1);

        // Act
        vm.expectRevert("exists");
        vm.prank(instance.account);
        validator.addPasskey(existing.init.idRaw, existing.init.px, existing.init.py);
    }

    function test_remove_passkey_emits_event_and_decrements_count() public {
        // Arrange
        PassKeyDemo.PasskeyCredential memory additional = PassKeyDemo.getPasskey(0);
        vm.prank(instance.account);
        validator.addPasskey(additional.init.idRaw, additional.init.px, additional.init.py);

        // Act
        vm.expectEmit(true, true, false, false);
        emit PasskeyValidator.PasskeyRemoved(instance.account, additional.init.idRaw);
        vm.prank(instance.account);
        validator.removePasskey(additional.init.idRaw);

        uint256 count = validator.passkeyCount(instance.account);

        // Assert
        assertEq(count, 1, "removing extra passkey should restore count");
    }

    function test_remove_passkey_reverts_when_missing() public {
        // Arrange
        bytes32 missingId = keccak256("missing-passkey");

        // Act
        vm.expectRevert("no such key");
        vm.prank(instance.account);
        validator.removePasskey(missingId);
    }

    function test_validate_user_op_succeeds_and_blocks_replay() public {
        // Arrange
        (UserOpData memory userOpData, bytes memory signature,) = _prepareUserOpSignature(1);
        userOpData.userOp.signature = signature;

        // Act
        uint256 result = _callValidateUserOp(userOpData);

        // Assert
        uint256 expected = uint256(type(uint48).max) << 160;
        assertEq(
            result,
            expected,
            "successful validation should yield open validity"
        );

        // Act
        uint256 replay = _callValidateUserOp(userOpData);

        // Assert
        assertEq(
            replay,
            1,
            "replayed signature counter should fail validation"
        );
    }

    function test_validate_user_op_accepts_zero_counter_on_repeated_use_for_zero_counter_authenticators() public {
        // Arrange
        (UserOpData memory userOpData, bytes memory signature,) = _prepareUserOpSignature(0);
        userOpData.userOp.signature = signature;

        // Act
        uint256 firstResult = _callValidateUserOp(userOpData);
        uint256 secondResult = _callValidateUserOp(userOpData);

        // Assert
        uint256 expected = uint256(type(uint48).max) << 160;
        assertEq(firstResult, expected, "zero-start authenticators should validate on first use");
        assertEq(secondResult, expected, "zero-counter authenticators should remain usable");
    }

    function test_validate_user_op_rejects_zero_counter_after_positive_counter_initialization() public {
        // Arrange
        (UserOpData memory freshUserOp, bytes memory freshSignature,) = _prepareUserOpSignature(1);
        freshUserOp.userOp.signature = freshSignature;
        uint256 expected = uint256(type(uint48).max) << 160;

        // Act
        uint256 firstResult = _callValidateUserOp(freshUserOp);
        (UserOpData memory zeroCounterUserOp, bytes memory zeroCounterSignature,) = _prepareUserOpSignature(0);
        zeroCounterUserOp.userOp.signature = zeroCounterSignature;
        uint256 zeroCounterResult = _callValidateUserOp(zeroCounterUserOp);

        // Assert
        assertEq(firstResult, expected, "positive counter should validate");
        assertEq(zeroCounterResult, 1, "falling back to zero after positive initialization must fail");
    }

    function test_validate_user_op_fails_for_unknown_passkey() public {
        // Arrange
        (UserOpData memory userOpData,, SignatureComponents memory components) = _prepareUserOpSignature(1);
        bytes memory forgedSignature = WebAuthnHelper.encodePasskeySignature(
            bytes32(uint256(111)),
            components.authenticatorData,
            components.clientDataJSON,
            components.challengeIndex,
            components.typeIndex,
            components.r,
            components.s
        );
        userOpData.userOp.signature = forgedSignature;

        // Act
        uint256 result = _callValidateUserOp(userOpData);

        // Assert
        assertEq(
            result,
            1,
            "unregistered passkey should flag sig failure"
        );
    }

    function test_validate_user_op_accepts_non_stored_rp_id_hash_when_signature_is_valid() public {
        // Arrange
        address target = makeAddr("userOpTargetAltRp");
        UserOpData memory userOpData = instance.getExecOps({
            target: target,
            value: 0,
            callData: "",
            txValidator: address(validator)
        });

        bytes32 alternateRpIdHash = bytes32(uint256(999));
        SignatureComponents memory components = _buildSignatureComponentsWithRpId(
            userOpData.userOpHash,
            1,
            alternateRpIdHash
        );
        bytes memory signature = WebAuthnHelper.encodePasskeySignature(
            dummyId,
            components.authenticatorData,
            components.clientDataJSON,
            components.challengeIndex,
            components.typeIndex,
            components.r,
            components.s
        );
        userOpData.userOp.signature = signature;

        // Act
        uint256 result = _callValidateUserOp(userOpData);

        // Assert
        uint256 expected = uint256(type(uint48).max) << 160;
        assertEq(
            result,
            expected,
            "rp hash is not enforced by the validator"
        );
    }

    function test_is_valid_signature_with_sender_checks_counter_progression() public {
        // Arrange
        (UserOpData memory userOpData, bytes memory opSignature,) = _prepareUserOpSignature(1);
        userOpData.userOp.signature = opSignature;
        _callValidateUserOp(userOpData);

        bytes32 messageHash = keccak256("1271-message");
        SignatureComponents memory freshComponents = _buildSignatureComponents(messageHash, 2);
        bytes memory freshSignature = WebAuthnHelper.encodePasskeySignature(
            dummyId,
            freshComponents.authenticatorData,
            freshComponents.clientDataJSON,
            freshComponents.challengeIndex,
            freshComponents.typeIndex,
            freshComponents.r,
            freshComponents.s
        );

        // Act
        bytes4 success = validator.isValidSignatureWithSender(
            instance.account,
            messageHash,
            freshSignature
        );

        // Assert
        assertEq(
            uint32(success),
            uint32(0x1626ba7e),
            "fresh counter must satisfy ERC-1271 check"
        );

        SignatureComponents memory staleComponents = _buildSignatureComponents(messageHash, 1);
        bytes memory staleSignature = WebAuthnHelper.encodePasskeySignature(
            dummyId,
            staleComponents.authenticatorData,
            staleComponents.clientDataJSON,
            staleComponents.challengeIndex,
            staleComponents.typeIndex,
            staleComponents.r,
            staleComponents.s
        );

        // Act
        bytes4 failure = validator.isValidSignatureWithSender(
            instance.account,
            messageHash,
            staleSignature
        );

        // Assert
        assertEq(
            uint32(failure),
            uint32(0xffffffff),
            "stale counter should fail ERC-1271 check"
        );
    }

    function test_validate_signature_with_data_enforces_sender_and_counter() public {
        // Arrange
        bytes32 messageHash = keccak256("validate-data");
        SignatureComponents memory signatureComponents = _buildSignatureComponents(messageHash, 1);
        bytes memory signature = WebAuthnHelper.encodePasskeySignature(
            dummyId,
            signatureComponents.authenticatorData,
            signatureComponents.clientDataJSON,
            signatureComponents.challengeIndex,
            signatureComponents.typeIndex,
            signatureComponents.r,
            signatureComponents.s
        );

        // Act
        bool ok = validator.validateSignatureWithData(
            messageHash,
            signature,
            abi.encode(instance.account)
        );

        // Assert
        assertTrue(ok, "matching sender and fresh counter should validate");

        bool wrongSender = validator.validateSignatureWithData(
            messageHash,
            signature,
            abi.encode(makeAddr("wrongSender"))
        );
        assertFalse(wrongSender, "incorrect sender context must fail");

        // Arrange
        (UserOpData memory userOpData, bytes memory opSignature,) = _prepareUserOpSignature(1);
        userOpData.userOp.signature = opSignature;
        _callValidateUserOp(userOpData);

        // Act
        bool stale = validator.validateSignatureWithData(
            messageHash,
            signature,
            abi.encode(instance.account)
        );

        // Assert
        assertFalse(stale, "stale counter should fail after stateful validation");
    }

    function test_is_valid_signature_with_sender_accepts_zero_counter_before_first_stateful_use() public {
        // Arrange
        bytes32 messageHash = keccak256("1271-zero-first");
        SignatureComponents memory components = _buildSignatureComponents(messageHash, 0);
        bytes memory signature = WebAuthnHelper.encodePasskeySignature(
            dummyId,
            components.authenticatorData,
            components.clientDataJSON,
            components.challengeIndex,
            components.typeIndex,
            components.r,
            components.s
        );

        // Act
        bytes4 result = validator.isValidSignatureWithSender(instance.account, messageHash, signature);

        // Assert
        assertEq(uint32(result), uint32(0x1626ba7e), "first zero counter should be accepted");
    }

    function test_is_valid_signature_with_sender_accepts_repeated_zero_counter_for_zero_counter_authenticators()
        public
    {
        // Arrange
        (UserOpData memory userOpData, bytes memory opSignature,) = _prepareUserOpSignature(0);
        userOpData.userOp.signature = opSignature;
        _callValidateUserOp(userOpData);

        bytes32 messageHash = keccak256("1271-zero-repeat");
        SignatureComponents memory components = _buildSignatureComponents(messageHash, 0);
        bytes memory signature = WebAuthnHelper.encodePasskeySignature(
            dummyId,
            components.authenticatorData,
            components.clientDataJSON,
            components.challengeIndex,
            components.typeIndex,
            components.r,
            components.s
        );

        // Act
        bytes4 result = validator.isValidSignatureWithSender(instance.account, messageHash, signature);

        // Assert
        assertEq(uint32(result), uint32(0x1626ba7e), "zero-counter authenticators should remain usable");
    }

    function _prepareUserOpSignature(uint32 counter)
        internal
        returns (UserOpData memory, bytes memory, SignatureComponents memory)
    {
        address target = makeAddr("userOpTarget");
        UserOpData memory userOpData = instance.getExecOps({
            target: target,
            value: 0,
            callData: "",
            txValidator: address(validator)
        });

        SignatureComponents memory components = _buildSignatureComponents(userOpData.userOpHash, counter);
        bytes memory signature = WebAuthnHelper.encodePasskeySignature(
            dummyId,
            components.authenticatorData,
            components.clientDataJSON,
            components.challengeIndex,
            components.typeIndex,
            components.r,
            components.s
        );

        return (userOpData, signature, components);
    }

    function _buildSignatureComponents(bytes32 challenge, uint32 counter)
        internal
        view
        returns (SignatureComponents memory components)
    {
        return _buildSignatureComponentsWithRpId(challenge, counter, rpHash);
    }

    function _buildSignatureComponentsWithRpId(bytes32 challenge, uint32 counter, bytes32 adRpIdHash)
        internal
        view
        returns (SignatureComponents memory components)
    {
        components.authenticatorData = WebAuthnHelper.buildAuthenticatorData(adRpIdHash, true, counter);
        (components.clientDataJSON, components.challengeIndex, components.typeIndex) =
            WebAuthnHelper.buildClientDataJSONAndIndices(challenge);

        bytes32 msgHash =
            WebAuthnHelper.webAuthnMessageHash(components.authenticatorData, components.clientDataJSON);
        (components.r, components.s) = signer.signDigestWithNonce(msgHash, passkeyPrivateKey, 0);
    }

    function _callValidateUserOp(UserOpData memory userOpData) internal returns (uint256) {
        (bool success, bytes memory ret) = address(validator).call(
            abi.encodeWithSelector(
                PasskeyValidator.validateUserOp.selector,
                userOpData.userOp,
                userOpData.userOpHash
            )
        );
        assertTrue(success, "validateUserOp call failed");
        return abi.decode(ret, (uint256));
    }
}
