// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ISocialRecovery} from "./interfaces/ISocialRecovery.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {ERC7579ModuleBase} from "lib/modulekit/src/module-bases/ERC7579ModuleBase.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

interface ISocialRecoveryAccount {
    function addPasskeyFromRecovery(PasskeyTypes.PasskeyInit calldata newPassKey) external;
    function isRecoveryModule(address module) external view returns (bool);
}

contract SocialRecovery is ISocialRecovery, ERC7579ModuleBase, EIP712("SocialRecoveryModule", "1.0.0") {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event HashedApproval(address indexed guardian, bytes32 indexed hash);
    event RejectHash(address indexed guardian, bytes32 indexed hash);
    event RecoveryScheduled(address indexed wallet, bytes32 indexed recoveryId, uint256 executeAfter);
    event RecoveryExecuted(address indexed wallet, bytes32 indexed recoveryId);
    event RecoveryCancelled(address indexed wallet, bytes32 indexed recoveryId);
    event GuardiansUpdated(address indexed wallet, uint256 threshold);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error SocialRecovery_GuardianLengthMustBeNonZero();
    error SocialRecovery_GuardianMustBeNonZero();
    error SocialRecovery_ThresholdMustBeNonZero();
    error SocialRecovery_ThresholdMustBeLessThanGuardians();
    error SocialRecovery_DuplicateGuardian(address guardian);
    error SocialRecovery_UnknownSignatureKind(uint8 kind);
    error SocialRecovery_InvalidEOASignatureLength(uint256 length);
    error SocialRecovery_InvalidGuardianIndex(uint256 index);
    error SocialRecovery_OperationAlreadyScheduled(bytes32 recoveryId);
    error HASH_ALREADY_APPROVED();
    error HASH_ALREADY_REJECTED();
    error SocialRecovery_InvalidSignatures();
    error SocialRecovery_InvalidRecoveryState(bytes32 recoveryId, OperationState state);
    error SocialRecovery_NoActiveRecovery();
    error SocialRecovery_GuardianNotFound(address guardian);
    error SocialRecovery_InvalidRecoveryId(bytes32 expected, bytes32 provided);
    error SocialRecovery_ModuleNotAuthorized();

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    mapping(address => RecoveryDetails) private _recoveryDetails;
    mapping(bytes32 => uint256) public approvedHashes;
    uint256 internal immutable TIME_LOCK = 1 days;
    bytes4 private constant ERC1271_MAGICVALUE = 0x1626ba7e;
    bytes32 private constant _TYPE_HASH_PASSKEY_INIT =
        keccak256("PasskeyInit(bytes32 idRaw,uint256 px,uint256 py,bytes32 rpIdHash)");
    bytes32 private constant _TYPE_HASH_SOCIAL_RECOVERY = keccak256(
        "SocialRecovery(address wallet,uint256 nonce,PasskeyInit newPassKey)PasskeyInit(bytes32 idRaw,uint256 px,uint256 py,bytes32 rpIdHash)"
    );

    /*//////////////////////////////////////////////////////////////
                            MODULE LIFECYCLE
    //////////////////////////////////////////////////////////////*/
    /**
     * @dev This function is called by the smart account during installation of the module
     * @param data arbitrary data that may be required on the module during `onInstall`
     * initialization
     *
     * MUST revert on error (i.e. if module is already enabled)
     */
    function onInstall(bytes calldata data) external {
        address account = msg.sender;
        if (isInitialized(account)) {
            revert ModuleAlreadyInitialized(account);
        }
        (address[] memory guardians, uint256 threshold) = abi.decode(data, (address[], uint256));
        if (guardians.length == 0) {
            revert SocialRecovery_GuardianLengthMustBeNonZero();
        }
        if (threshold == 0 || threshold > guardians.length) {
            revert SocialRecovery_ThresholdMustBeLessThanGuardians();
        }
        RecoveryDetails storage details = _recoveryDetails[account];
        details.threshold = threshold;
        for (uint256 i = 0; i < guardians.length; i++) {
            address guardian = guardians[i];
            if (guardian == address(0)) {
                revert SocialRecovery_GuardianMustBeNonZero();
            }
            for (uint256 j = 0; j < i; j++) {
                if (guardians[j] == guardian) {
                    revert SocialRecovery_DuplicateGuardian(guardian);
                }
            }
            details.guardians.push(guardian);
        }
    }

    /**
     * @dev This function is called by the smart account during uninstallation of the module
     * @param /data arbitrary data that may be required on the module during `onUninstall`
     * de-initialization
     *
     * MUST revert on error
     */
    function onUninstall(bytes calldata /*data*/ ) external {
        address account = msg.sender;
        if (!isInitialized(account)) {
            revert NotInitialized(account);
        }
        delete _recoveryDetails[account];
    }

    /*//////////////////////////////////////////////////////////////
                                RECOVERY
    //////////////////////////////////////////////////////////////*/

    function scheduleRecovery(address wallet, PasskeyTypes.PasskeyInit calldata newPassKey, GuardianSig[] calldata sigs)
        external
        returns (bytes32 recoveryId)
    {
        if (!isInitialized(wallet)) {
            revert NotInitialized(wallet);
        }
        if (!ISocialRecoveryAccount(wallet).isRecoveryModule(address(this))) {
            revert SocialRecovery_ModuleNotAuthorized();
        }
        recoveryId = getRecoveryId(wallet, newPassKey);
        RecoveryDetails storage details = _recoveryDetails[wallet];
        OperationState state = _currentOperationState(details);
        if (
            details.activeRecoveryId != bytes32(0) && (state == OperationState.Waiting || state == OperationState.Ready)
        ) {
            revert SocialRecovery_OperationAlreadyScheduled(details.activeRecoveryId);
        }
        if (sigs.length < details.threshold) {
            revert SocialRecovery_ThresholdMustBeLessThanGuardians();
        }
        uint256 nonce = details.nonce;
        if (!verifyGuardianSignatures(wallet, nonce, newPassKey, sigs)) {
            revert SocialRecovery_InvalidSignatures();
        }
        details.activeRecoveryId = recoveryId;
        details.activeRecoveryExecuteAfter = block.timestamp + TIME_LOCK;
        details.nonce = nonce + 1;
        emit RecoveryScheduled(wallet, recoveryId, details.activeRecoveryExecuteAfter);
        return recoveryId;
    }

    function getRecoveryId(address wallet, PasskeyTypes.PasskeyInit calldata newPassKey)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(wallet, _hashPasskeyInit(newPassKey)));
    }

    function getRecoveryDigest(address wallet, uint256 nonce, PasskeyTypes.PasskeyInit calldata newPassKey)
        external
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(abi.encode(_TYPE_HASH_SOCIAL_RECOVERY, wallet, nonce, _hashPasskeyInit(newPassKey)))
        );
    }

    /*//////////////////////////////////////////////////////////////
                               VALIDATION
    //////////////////////////////////////////////////////////////*/

    function verifyGuardianSignatures(
        address wallet,
        uint256 nonce,
        PasskeyTypes.PasskeyInit calldata newPassKey,
        GuardianSig[] calldata sigs
    ) internal view returns (bool) {
        RecoveryDetails storage details = _recoveryDetails[wallet];
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(_TYPE_HASH_SOCIAL_RECOVERY, wallet, nonce, _hashPasskeyInit(newPassKey)))
        );
        for (uint256 i = 0; i < sigs.length; i++) {
            GuardianSig calldata sig = sigs[i];
            if (sig.index >= details.guardians.length) {
                revert SocialRecovery_InvalidGuardianIndex(sig.index);
            }
            address guardian = details.guardians[sig.index];

            if (sig.kind == SigKind.EOA_ECDSA) {
                (uint8 v, bytes32 r, bytes32 s) = _parseEOASignature(sig.sig);
                address recovered = ecrecover(digest, v, r, s);
                if (recovered != guardian) {
                    return false;
                }
            } else if (sig.kind == SigKind.ERC1271) {
                (bool success, bytes memory result) =
                    guardian.staticcall(abi.encodeWithSignature("isValidSignature(bytes32,bytes)", digest, sig.sig));
                if (!success || result.length != 32) {
                    return false;
                }
                bytes4 magicValue = abi.decode(result, (bytes4));
                if (magicValue != ERC1271_MAGICVALUE) {
                    return false;
                }
            } else if (sig.kind == SigKind.APPROVE_HASH) {
                bytes32 approvedKey = _hashKey(details.guardians[sig.index], digest);
                uint256 approved = approvedHashes[approvedKey];
                if (approved == 0) {
                    return false;
                }
            } else {
                revert SocialRecovery_UnknownSignatureKind(uint8(sig.kind));
            }
        }
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                           RECOVERY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function executeRecovery(address wallet, PasskeyTypes.PasskeyInit calldata newPassKey) external override {
        if (!isInitialized(wallet)) {
            revert NotInitialized(wallet);
        }
        if (!ISocialRecoveryAccount(wallet).isRecoveryModule(address(this))) {
            revert SocialRecovery_ModuleNotAuthorized();
        }
        RecoveryDetails storage details = _recoveryDetails[wallet];
        bytes32 recoveryId = details.activeRecoveryId;
        if (recoveryId == bytes32(0)) {
            revert SocialRecovery_NoActiveRecovery();
        }
        OperationState state = _currentOperationState(details);
        if (state != OperationState.Ready) {
            revert SocialRecovery_InvalidRecoveryState(recoveryId, state);
        }
        bytes32 computedId = getRecoveryId(wallet, newPassKey);
        if (computedId != recoveryId) {
            revert SocialRecovery_InvalidRecoveryId(recoveryId, computedId);
        }
        _applyRecoveryResult(wallet, newPassKey);
        emit RecoveryExecuted(wallet, recoveryId);
        _resetActiveRecovery(details);
    }

    function cancelRecovery(address wallet, bytes32 recoveryId) external override {
        if (!isInitialized(wallet)) {
            revert NotInitialized(wallet);
        }
        if (!ISocialRecoveryAccount(wallet).isRecoveryModule(address(this))) {
            revert SocialRecovery_ModuleNotAuthorized();
        }
        RecoveryDetails storage details = _recoveryDetails[wallet];
        bytes32 activeId = details.activeRecoveryId;
        if (activeId == bytes32(0)) {
            revert SocialRecovery_NoActiveRecovery();
        }
        if (activeId != recoveryId) {
            revert SocialRecovery_InvalidRecoveryId(activeId, recoveryId);
        }
        OperationState state = _currentOperationState(details);
        if (state != OperationState.Waiting && state != OperationState.Ready) {
            revert SocialRecovery_InvalidRecoveryState(recoveryId, state);
        }
        emit RecoveryCancelled(wallet, recoveryId);
        _resetActiveRecovery(details);
    }

    function addGuardians(address wallet, address[] calldata newGuardians, uint256 newThreshold) external override {
        if (!isInitialized(wallet)) {
            revert NotInitialized(wallet);
        }
        RecoveryDetails storage details = _recoveryDetails[wallet];
        for (uint256 i = 0; i < newGuardians.length; i++) {
            address guardian = newGuardians[i];
            if (guardian == address(0)) {
                revert SocialRecovery_GuardianMustBeNonZero();
            }
            if (_hasGuardian(details.guardians, guardian)) {
                revert SocialRecovery_DuplicateGuardian(guardian);
            }
            details.guardians.push(guardian);
        }
        uint256 updatedThreshold = newThreshold == 0 ? details.threshold : newThreshold;
        if (updatedThreshold == 0) {
            revert SocialRecovery_ThresholdMustBeNonZero();
        }
        if (updatedThreshold > details.guardians.length) {
            revert SocialRecovery_ThresholdMustBeLessThanGuardians();
        }
        if (details.threshold != updatedThreshold) {
            details.threshold = updatedThreshold;
        }
        emit GuardiansUpdated(wallet, details.threshold);
    }

    function removeGuardians(address wallet, address[] calldata exGuardians, uint256 newThreshold) external override {
        if (!isInitialized(wallet)) {
            revert NotInitialized(wallet);
        }
        RecoveryDetails storage details = _recoveryDetails[wallet];
        for (uint256 i = 0; i < exGuardians.length; i++) {
            address guardian = exGuardians[i];
            if (!_removeGuardian(details.guardians, guardian)) {
                revert SocialRecovery_GuardianNotFound(guardian);
            }
        }
        if (details.guardians.length == 0) {
            revert SocialRecovery_GuardianLengthMustBeNonZero();
        }
        uint256 updatedThreshold = newThreshold == 0 ? details.threshold : newThreshold;
        if (updatedThreshold == 0) {
            revert SocialRecovery_ThresholdMustBeNonZero();
        }
        if (updatedThreshold > details.guardians.length) {
            revert SocialRecovery_ThresholdMustBeLessThanGuardians();
        }
        if (details.threshold != updatedThreshold) {
            details.threshold = updatedThreshold;
        }
        emit GuardiansUpdated(wallet, details.threshold);
    }

    function getRecoveryDetails(address wallet)
        external
        view
        override
        returns (address[] memory guardians, uint256 threshold)
    {
        RecoveryDetails storage details = _recoveryDetails[wallet];
        guardians = details.guardians;
        threshold = details.threshold;
    }

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function approveHash(bytes32 hash) external {
        bytes32 approvedKey = _hashKey(msg.sender, hash);
        if (approvedHashes[approvedKey] != 0) {
            revert HASH_ALREADY_APPROVED();
        }
        approvedHashes[approvedKey] = 1;
        emit HashedApproval(msg.sender, hash);
    }

    function rejectHash(bytes32 hash) external {
        bytes32 key = _hashKey(msg.sender, hash);
        if (approvedHashes[key] == 0) {
            revert HASH_ALREADY_REJECTED();
        }
        approvedHashes[key] = 0;
        emit RejectHash(msg.sender, hash);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL Functions
    //////////////////////////////////////////////////////////////*/

    function _applyRecoveryResult(address wallet, PasskeyTypes.PasskeyInit calldata newPassKey) internal {
        ISocialRecoveryAccount(wallet).addPasskeyFromRecovery(newPassKey);
    }

    function _hashPasskeyInit(PasskeyTypes.PasskeyInit calldata passkey) internal pure returns (bytes32) {
        return keccak256(abi.encode(_TYPE_HASH_PASSKEY_INIT, passkey.idRaw, passkey.px, passkey.py, passkey.rpIdHash));
    }

    function _parseEOASignature(bytes memory signature) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        if (signature.length != 65) {
            revert SocialRecovery_InvalidEOASignatureLength(signature.length);
        }
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) {
            v += 27;
        }
    }

    function _currentOperationState(RecoveryDetails storage details) internal view returns (OperationState) {
        if (details.activeRecoveryId == bytes32(0)) {
            return OperationState.Unset;
        }
        if (details.activeRecoveryExecuteAfter == 0) {
            return OperationState.Unset;
        }
        if (block.timestamp < details.activeRecoveryExecuteAfter) {
            return OperationState.Waiting;
        }
        return OperationState.Ready;
    }

    function _hasGuardian(address[] storage guardians, address guardian) internal view returns (bool) {
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                return true;
            }
        }
        return false;
    }

    function _removeGuardian(address[] storage guardians, address guardian) internal returns (bool) {
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                uint256 lastIndex = guardians.length - 1;
                if (i != lastIndex) {
                    guardians[i] = guardians[lastIndex];
                }
                guardians.pop();
                return true;
            }
        }
        return false;
    }

    function _resetActiveRecovery(RecoveryDetails storage details) internal {
        details.activeRecoveryId = bytes32(0);
        details.activeRecoveryExecuteAfter = 0;
    }

    function _hashKey(address guardian, bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(guardian, hash));
    }

    /*//////////////////////////////////////////////////////////////
                              MODULE INFO
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns if the module was already initialized for a provided smartaccount
     */
    function isInitialized(address smartAccount) public view returns (bool) {
        if (_recoveryDetails[smartAccount].guardians.length > 0) {
            return true;
        }
        return false;
    }

    /**
     * Check if the module is of a certain type
     *
     * @param typeID The type ID to check
     *
     * @return true if the module is of the given type, false otherwise
     */
    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == TYPE_EXECUTOR;
    }
}
