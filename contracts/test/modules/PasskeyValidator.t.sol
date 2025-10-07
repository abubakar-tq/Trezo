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
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
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
    bytes32 internal rpIdHash;

    uint256 internal px;
    uint256 internal py;

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
        // abi.encode(bytes32 idRaw, uint256 px, uint256 py, bytes32 rpIdHash)
        PassKeyDemo.PasskeyCredential memory passkey = PassKeyDemo.getPasskey(1);
        dummyId = passkey.init.idRaw;
        px = passkey.init.px;
        py = passkey.init.py;
        rpIdHash = passkey.init.rpIdHash;
        instance.installModule({
            moduleTypeId: MODULE_TYPE_VALIDATOR,
            module: address(validator),
            data: abi.encode(dummyId, px, py, rpIdHash)
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

        bytes memory ad = WebAuthnHelper.buildAuthenticatorData(rpIdHash, true, 1);
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

        bytes memory ad = WebAuthnHelper.buildAuthenticatorData(rpIdHash, true, 1);
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
}
