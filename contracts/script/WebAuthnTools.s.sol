// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import { WebAuthnTestUtils } from "test/modules/utils/WebAuthnTestUtils.sol";

/// @title WebAuthnTools
/// @notice Foundry script with callable entrypoints to compute WebAuthn helper values
///         from the WebAuthnTestUtils library. Call with `forge script --sig`.
contract WebAuthnTools is Script {
    using WebAuthnTestUtils for *;

    // rpIdHash
    function runRpIdHash(string memory rpId) external pure {
        bytes32 rpHash = WebAuthnTestUtils.rpIdHash(rpId);
        console2.logBytes32(rpHash);
    }

    // authenticatorData
    function runBuildAuthenticatorData(bytes32 rpIdHash, bool requireUV, uint32 counter) external pure {
        bytes memory ad = WebAuthnTestUtils.buildAuthenticatorData(rpIdHash, requireUV, counter);
        console2.logBytes(ad);
    }

    // clientDataJSON + indices
    function runBuildClientDataJSONAndIndices(bytes32 challenge) external pure {
        (string memory cjson, uint256 cIdx, uint256 tIdx) =
            WebAuthnTestUtils.buildClientDataJSONAndIndices(challenge);
        console2.logString(cjson);
        console2.logUint(cIdx);
        console2.logUint(tIdx);
    }

    // message hash
    function runWebAuthnMessageHash(bytes memory authenticatorData, string memory clientDataJSON) external pure {
        bytes32 m = WebAuthnTestUtils.webAuthnMessageHash(authenticatorData, clientDataJSON);
        console2.logBytes32(m);
    }

    // onInstall data
    function runBuildOnInstallData(bytes32 idRaw, uint256 px, uint256 py, bytes32 rpIdHash) external pure {
        bytes memory data = WebAuthnTestUtils.buildOnInstallData(idRaw, px, py, rpIdHash);
        console2.logBytes(data);
    }

    // encode signature payload
    function runEncodePasskeySignature(
        bytes32 idRaw,
        bytes memory authenticatorData,
        string memory clientDataJSON,
        uint256 challengeIndex,
        uint256 typeIndex,
        uint256 r,
        uint256 s
    ) external pure {
        bytes memory sig = WebAuthnTestUtils.encodePasskeySignature(
            idRaw, authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s
        );
        console2.logBytes(sig);
    }
}

