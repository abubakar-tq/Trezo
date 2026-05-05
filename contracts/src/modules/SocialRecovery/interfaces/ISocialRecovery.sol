// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/common/Types.sol";
import {RecoveryTypes} from "src/recovery/RecoveryTypes.sol";

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
        uint256 timelockSeconds;
        uint256 nonce;
    }

    function scheduleRecovery(
        address wallet,
        PasskeyTypes.PasskeyInit calldata newPassKey,
        RecoveryTypes.RecoveryIntent calldata intent,
        RecoveryTypes.ChainRecoveryScope[] calldata scopes,
        GuardianSig[] calldata sigs
    ) external returns (bytes32 recoveryId);

    function executeRecovery(address wallet) external;

    function cancelRecovery(address wallet, bytes32 recoveryId) external;

    function addGuardians(address wallet, address[] calldata newGuardians, uint256 newThreshold) external;

    function removeGuardians(address wallet, address[] calldata exGuardians, uint256 newThreshold) external;

    function getRecoveryDetails(address wallet) external view returns (address[] memory guardians, uint256 threshold);

    function getRecoveryNonce(address wallet) external view returns (uint256 nonce);

    function getRecoveryTimelock(address wallet) external view returns (uint256 timelockSeconds);

    function getGuardianSetHash(address wallet) external view returns (bytes32);

    function getPolicyHash(address wallet) external view returns (bytes32);

    function getChainScopeHash(RecoveryTypes.ChainRecoveryScope[] calldata scopes) external pure returns (bytes32);

    function getRecoveryDigest(RecoveryTypes.RecoveryIntent calldata intent) external view returns (bytes32);

    function getActiveRecovery(address wallet) external view returns (bytes32 recoveryId, uint256 executeAfter);
}
