// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {FCL_ecdsa_utils} from "lib/webauthn-sol/lib/FreshCryptoLib/solidity/src/FCL_ecdsa_utils.sol";
import {FCL_Elliptic_ZZ} from "lib/webauthn-sol/lib/FreshCryptoLib/solidity/src/FCL_elliptic.sol";

/// @notice Utility script to create secp256r1 (P-256) signatures directly via Foundry.
///         Provides deterministic-nonce signing so passkeys can be exercised without
///         external tooling.
contract P256Signer is Script {
    uint256 private constant _HALF_N = FCL_Elliptic_ZZ.n / 2;

    function run() public pure {
        revert("Use explicit entrypoints: signDigest, signDigestWithNonce, derivePublicKey");
    }

    /// @notice Sign a digest with a P-256 private key using an RFC6979-style deterministic nonce.
    /// @param digest Message hash to sign (already 32-byte SHA-256 digest).
    /// @param privKey P-256 private key in uint256 form.
    /// @return r Signature r.
    /// @return s Signature s (normalized to low-S form).
    function signDigest(bytes32 digest, uint256 privKey) external view returns (uint256 r, uint256 s) {
        uint256 nonce = _deterministicNonce(digest, privKey);
        (r, s) = _sign(digest, privKey, nonce);
        _logSignature(r, s, nonce);
    }

    /// @notice Sign a digest with an explicitly supplied nonce (must be 1 <= nonce < curve order).
    function signDigestWithNonce(bytes32 digest, uint256 privKey, uint256 nonce)
        external
        view
        returns (uint256 r, uint256 s)
    {
        nonce = _normalizeNonce(nonce);
        (r, s) = _sign(digest, privKey, nonce);
        _logSignature(r, s, nonce);
    }

    /// @notice Derive the affine P-256 public key for a private key.
    function derivePublicKey(uint256 privKey) external view returns (uint256 px, uint256 py) {
        _requireValidPriv(privKey);
        (px, py) = FCL_ecdsa_utils.ecdsa_derivKpub(privKey);
        console2.log("px", px);
        console2.log("py", py);
    }

    function _sign(bytes32 digest, uint256 privKey, uint256 nonce) internal view returns (uint256 r, uint256 s) {
        _requireValidPriv(privKey);
        (r, s) = FCL_ecdsa_utils.ecdsa_sign(digest, nonce, privKey);
        if (s > _HALF_N) {
            s = FCL_Elliptic_ZZ.n - s;
        }
    }

    function _deterministicNonce(bytes32 digest, uint256 privKey) internal pure returns (uint256 nonce) {
        nonce = uint256(keccak256(abi.encodePacked("trezo-p256-nonce", digest, privKey)));
        nonce = _normalizeNonce(nonce);
    }

    function _normalizeNonce(uint256 nonce) internal pure returns (uint256 normalized) {
        normalized = nonce % (FCL_Elliptic_ZZ.n - 1) + 1;
    }

    function _requireValidPriv(uint256 privKey) internal pure {
        require(privKey > 0 && privKey < FCL_Elliptic_ZZ.n, "P256:invalid-privkey");
    }

    function _logSignature(uint256 r, uint256 s, uint256 nonce) internal pure {
        console2.log("nonce", nonce);
        console2.log("r", r);
        console2.log("s", s);
        console2.log("raw (r||s)");
        bytes memory raw = abi.encodePacked(bytes32(r), bytes32(s));
        console2.logBytes(raw);
    }
}
