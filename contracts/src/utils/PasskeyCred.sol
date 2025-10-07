// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/modules/Types.sol";

/// @notice Helper library providing passkey fixtures used in tests and scripts.
/// @dev Fixture #0 leaves the private key empty; fixture #1 includes a deterministic
///      test key for convenience. Never reuse these keys in production deployments.
library PassKeyDemo {
    /// @notice Bundled passkey data with its (optional) private key.
    struct PasskeyCredential {
        PasskeyTypes.PasskeyInit init;
        bytes32 privateKey;
    }

    uint256 private constant _PASSKEY_COUNT = 2;

    /// @notice Return the passkey initialisation payload for the given fixture.
    /// @param index Fixture index.
    /// @return init The passkey init struct expected by the validator.
    function getPasskeyInit(uint256 index) external pure returns (PasskeyTypes.PasskeyInit memory init) {
        (init,) = _getPasskey(index);
    }

    /// @notice Return the placeholder private key for the given fixture.
    /// @dev Replace the zero value with your local P-256 private key before using signing helpers.
    /// @param index Fixture index.
    /// @return privateKey Passkey private key as bytes32.
    function getPasskeyPrivateKey(uint256 index) external pure returns (bytes32 privateKey) {
        (, privateKey) = _getPasskey(index);
    }

    /// @notice Return both the init payload and private key for a passkey fixture.
    /// @param index Fixture index.
    /// @return credential Combined passkey data and private key placeholder.
    function getPasskey(uint256 index) external pure returns (PasskeyCredential memory credential) {
        (credential.init, credential.privateKey) = _getPasskey(index);
    }

    /// @notice Count of bundled passkey fixtures available.
    function getPasskeyCount() external pure returns (uint256) {
        return _PASSKEY_COUNT;
    }

    function _getPasskey(uint256 index)
        private
        pure
        returns (PasskeyTypes.PasskeyInit memory init, bytes32 privateKey)
    {
        if (index == 0) {
            init = PasskeyTypes.PasskeyInit({
                idRaw: 0xffbafc0393479122d7dec91a53a60eb487cad5bb571d5d020ea0be916c37653e,
                px: uint256(0xfe54e4b6641ed408fc5abfafc5d2f37fdcc4545bfee5e1ca3401d200924d6d91),
                py: uint256(0xcb7ebd608bbc521a2b38e005fc9dcc963a4e3da22afab8cff0d370006250add2),
                rpIdHash: 0x638841ea13dd17405349cb4795e780a1105648d79c51e6671af0a66d7597f945
            });
            privateKey = 0x6722e0eb7c7e2ab7e2433f0cb25f0c889dbad5ea5443c949e2eaa969734070af;
            return (init, privateKey);
        } else if (index == 1) {
            init = PasskeyTypes.PasskeyInit({
                idRaw: 0x8b3d8b076d2577ee4636b431cda59668392b193126d0de23df96ce85f06b592e,
                px: uint256(0x42a4555a7f347ad2a6d94a338f6b23605ec0aa5395189dbcca7698cd4433ef34),
                py: uint256(0x0e6ab23954b8c24eb5c909bc95421d241ed2b04bbc47bc73f7c60785d0d7ecd4),
                rpIdHash: 0x638841ea13dd17405349cb4795e780a1105648d79c51e6671af0a66d7597f945
            });

            privateKey = 0xe869435ccce456e66779f607cad397fd79c6f3bb82d846b121121b128c569715;
            return (init, privateKey);
        }
        revert("PassKeyDemo: index out of bounds");
    }
}
