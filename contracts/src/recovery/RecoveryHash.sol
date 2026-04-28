// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {RecoveryTypes} from "src/recovery/RecoveryTypes.sol";

library RecoveryHash {
    function hashPasskeyInit(PasskeyTypes.PasskeyInit calldata passkey) internal pure returns (bytes32) {
        return keccak256(abi.encode(RecoveryTypes.PASSKEY_INIT_TYPEHASH, passkey.idRaw, passkey.px, passkey.py));
    }

    function hashPasskeyInitMemory(PasskeyTypes.PasskeyInit memory passkey) internal pure returns (bytes32) {
        return keccak256(abi.encode(RecoveryTypes.PASSKEY_INIT_TYPEHASH, passkey.idRaw, passkey.px, passkey.py));
    }

    function hashChainScope(RecoveryTypes.ChainRecoveryScope calldata scope) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RecoveryTypes.CHAIN_RECOVERY_SCOPE_TYPEHASH,
                scope.chainId,
                scope.wallet,
                scope.socialRecovery,
                scope.nonce,
                scope.guardianSetHash,
                scope.policyHash
            )
        );
    }

    function hashChainScopes(RecoveryTypes.ChainRecoveryScope[] calldata scopes) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](scopes.length);
        for (uint256 i = 0; i < scopes.length; i++) {
            hashes[i] = hashChainScope(scopes[i]);
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function hashRecoveryIntent(RecoveryTypes.RecoveryIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RecoveryTypes.RECOVERY_INTENT_TYPEHASH,
                intent.requestId,
                intent.newPasskeyHash,
                intent.chainScopeHash,
                intent.validAfter,
                intent.deadline,
                intent.metadataHash
            )
        );
    }

    function portableDomainSeparator(address verifyingContract) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RecoveryTypes.PORTABLE_DOMAIN_TYPEHASH,
                RecoveryTypes.PORTABLE_NAME_HASH,
                RecoveryTypes.PORTABLE_VERSION_HASH,
                verifyingContract
            )
        );
    }

    function hashPortableTypedData(address verifyingContract, bytes32 structHash) internal pure returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(portableDomainSeparator(verifyingContract), structHash);
    }
}
