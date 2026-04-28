// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/common/Types.sol";

interface ISocialRecovery {

    enum SigKind {
        EOA_ECDSA,
        ERC1271,
        APPROVE_HASH
    }

    enum OperationState {
        Unset,
        Waiting,
        Ready,
        Done,
        Cancelled
    }

    struct GuardianSig {
        uint16 index; // index into guardians[] at schedule time
        SigKind kind; // how to verify this approval
        bytes sig; // 65B for EOA; arbitrary for 1271; empty for APPROVE_HASH
    }

    struct RecoveryDetails {
        address[] guardians;
        uint256 threshold;
        bytes32 activeRecoveryId;
        uint256 activeRecoveryExecuteAfter;
        uint256 nonce;
    }

    function scheduleRecovery(address wallet, PasskeyTypes.PasskeyInit calldata newPassKey, GuardianSig[] calldata sigs)
        external
        returns (bytes32 recoveryId);

    function executeRecovery(address wallet, PasskeyTypes.PasskeyInit calldata newPassKey) external;

    function cancelRecovery(address wallet, bytes32 recoveryId) external;

    function addGuardians(address wallet, address[] calldata newGuardians, uint256 newThreshold) external;

    function removeGuardians(address wallet, address[] calldata exGuardians, uint256 newThreshold) external;

    function getRecoveryDetails(address wallet) external view returns (address[] memory guardians, uint256 threshold);

    function getRecoveryNonce(address wallet) external view returns (uint256 nonce);
    
    function isApproved(bytes32 hash, address guardian) external view returns (bool);
}
