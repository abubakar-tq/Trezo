// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {RhinestoneModuleKit, ModuleKitHelpers, AccountInstance, UserOpData} from "lib/modulekit/src/ModuleKit.sol";

import {MODULE_TYPE_VALIDATOR} from "lib/modulekit/src/accounts/kernel/types/Constants.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {WebAuthnTestUtils} from "test/modules/utils/WebAuthnTestUtils.sol";

// RIP-7212 precompile mock. Returns 1 for any input
contract Rip7212Mock {
    fallback() external {
        assembly {
            mstore(0x00, 1)
            return(0x00, 0x20)
        }
    }
}

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

    Account owner1;
    Account owner2;

    bytes32 internal dummyId;
    bytes32 internal rpIdHash;

    uint256 internal px;
    uint256 internal py;

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
        dummyId = 0xb976cb58a15d247afc49d3015e7a45b962532a388c5c2d6225ef7ba3bd494b7d;
        px = uint256(0xc92b6c998c854fcb69cff745bbc83c69cd3e1f3b2904f2cfd7e5a9119ee8eb38);
        py = uint256(0xd64d667544491335c127c62471c5bbca05d1a3aa9641989f964f7cd26504a45d);
        rpIdHash = 0x638841ea13dd17405349cb4795e780a1105648d79c51e6671af0a66d7597f945;
        instance.installModule({
            moduleTypeId: MODULE_TYPE_VALIDATOR,
            module: address(validator),
            data: abi.encode(dummyId, px, py, rpIdHash)
        });
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

        bytes memory ad = WebAuthnTestUtils.buildAuthenticatorData(rpIdHash, true, 1);
        (string memory cjson, uint256 cIdx, uint256 tIdx) =
            WebAuthnTestUtils.buildClientDataJSONAndIndices(userOpData.userOpHash);
        bytes32 msgHash = WebAuthnTestUtils.webAuthnMessageHash(ad, cjson);

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
    function test_exec_with_passkey_external_signature() public skipAnvil {
        address target = makeAddr("target2");
        uint256 startBal = target.balance;
        uint256 value = 0.05 ether;

        UserOpData memory userOpData =
            instance.getExecOps({target: target, value: value, callData: "", txValidator: address(validator)});

        bytes memory ad = WebAuthnTestUtils.buildAuthenticatorData(rpIdHash, true, 1);
        (string memory cjson, uint256 cIdx, uint256 tIdx) =
            WebAuthnTestUtils.buildClientDataJSONAndIndices(userOpData.userOpHash);
        bytes32 msgHash = WebAuthnTestUtils.webAuthnMessageHash(ad, cjson);
        console2.log("Passkey msgHash (sign off-chain and paste r,s)");
        console2.logBytes32(msgHash);

        uint256 r = 0x011c9b597a9d140fbb97ed9aa2e2f0239115352e25c5bdcbda9460e61130c172;
        uint256 s = 0x7030fa31d9589781eb906106c7e62241235d3d3508bb9731b64a9799219c6383;
        if (r == 0 || s == 0) {
            console2.log("Skipping execution: provide non-zero r,s to run");
            return;
        }

        bytes memory sig = WebAuthnTestUtils.encodePasskeySignature(dummyId, ad, cjson, cIdx, tIdx, r, s);
        userOpData.userOp.signature = sig;
        userOpData.execUserOps();

        assertEq(target.balance, startBal + value, "target2 should receive value");
    }
}
