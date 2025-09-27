// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { Base64 } from "lib/webauthn-sol/lib/openzeppelin-contracts/contracts/utils/Base64.sol";

/// @title WebAuthnTestUtils
/// @notice Utilities to build WebAuthn assertion components for testing PasskeyValidator.
///         These functions help compose authenticatorData, clientDataJSON, indices, message hash,
///         onInstall data, and to ABI-encode the signature payload expected by the validator.
library WebAuthnTestUtils {
    /// @dev Bit flags for WebAuthn authenticatorData[32]
    bytes1 internal constant FLAG_UP = 0x01; // User Present
    bytes1 internal constant FLAG_UV = 0x04; // User Verified

    /// @notice Compute rpIdHash = sha256(rpId)
    function rpIdHash(string memory rpId) internal pure returns (bytes32) {
        return sha256(bytes(rpId));
    }

    /// @notice Build authenticatorData = rpIdHash || flags || counter(be)
    function buildAuthenticatorData(bytes32 _rpIdHash, bool requireUV, uint32 counter)
        internal
        pure
        returns (bytes memory ad)
    {
        bytes1 flags = requireUV ? (FLAG_UP | FLAG_UV) : FLAG_UP;
        ad = abi.encodePacked(_rpIdHash, flags, bytes4(counter));
    }

    /// @notice Build clientDataJSON with base64url-encoded challenge and return indices for type/challenge
    function buildClientDataJSONAndIndices(bytes32 challenge)
        internal
        pure
        returns (string memory clientDataJSON, uint256 challengeIndex, uint256 typeIndex)
    {
        string memory ch64 = Base64.encodeURL(abi.encodePacked(challenge));
        clientDataJSON = string.concat('{"type":"webauthn.get","challenge":"', ch64, '"}');

        bytes memory cbytes = bytes(clientDataJSON);
        bytes memory typeBytes = bytes('\"type\":\"webauthn.get\"');
        bytes memory challengeBytes = bytes(string.concat('\"challenge\":\"', ch64, '\"'));

        typeIndex = indexOf(cbytes, typeBytes);
        challengeIndex = indexOf(cbytes, challengeBytes);
        require(typeIndex != type(uint256).max && challengeIndex != type(uint256).max, "WA:bad-indices");
    }

    /// @notice Compute WebAuthn message hash = sha256(authenticatorData || sha256(clientDataJSON))
    function webAuthnMessageHash(bytes memory authenticatorData, string memory clientDataJSON)
        internal
        pure
        returns (bytes32)
    {
        bytes32 cjsonHash = sha256(bytes(clientDataJSON));
        return sha256(abi.encodePacked(authenticatorData, cjsonHash));
    }

    /// @notice ABI-encode the signature payload expected by PasskeyValidator
    function encodePasskeySignature(
        bytes32 idRaw,
        bytes memory authenticatorData,
        string memory clientDataJSON,
        uint256 challengeIndex,
        uint256 typeIndex,
        uint256 r,
        uint256 s
    ) internal pure returns (bytes memory sig) {
        sig = abi.encode(idRaw, authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s);
    }

    /// @notice Helper to build onInstall data: abi.encode(idRaw, px, py, rpIdHash)
    function buildOnInstallData(bytes32 idRaw, uint256 px, uint256 py, bytes32 _rpIdHash)
        internal
        pure
        returns (bytes memory data)
    {
        data = abi.encode(idRaw, px, py, _rpIdHash);
    }

    /// @notice Find the index of a needle in a haystack (bytes), or max uint if not found
    function indexOf(bytes memory haystack, bytes memory needle) internal pure returns (uint256) {
        if (needle.length == 0 || haystack.length < needle.length) return type(uint256).max;
        for (uint256 i; i + needle.length <= haystack.length; i++) {
            bool matchAll = true;
            for (uint256 j; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) { matchAll = false; break; }
            }
            if (matchAll) return i;
        }
        return type(uint256).max;
    }
}

