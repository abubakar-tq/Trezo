// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/common/Types.sol";
import {RecoveryHash} from "src/recovery/RecoveryHash.sol";
import {RecoveryTypes} from "src/recovery/RecoveryTypes.sol";
import {IEmailRecovery} from "./interfaces/IEmailRecovery.sol";
import {IEmailRecoveryAccount} from "./interfaces/IEmailRecoveryAccount.sol";
import {ERC7579ExecutorBase} from "lib/modulekit/src/Modules.sol";
import {EmailRecoveryManager} from "email-recovery/EmailRecoveryManager.sol";

/**
 * @title EmailRecovery
 * @notice Executor module that wires the zkEmail recovery flow to our SmartAccount's
 *         passkey-based authentication. Guardians approve a recovery hash via email,
 *         then this module installs a new passkey on the account once the delay elapses.
 */
contract EmailRecovery is EmailRecoveryManager, ERC7579ExecutorBase, IEmailRecovery {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event RecoveryExecuted(address indexed account, bytes32 indexed passkeyId);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error InvalidOnInstallData();
    error InvalidPasskey(bytes32 id);
    error InvalidPasskeyCoordinates();
    error InvalidEmailRecoveryDataVersion(uint8 version);
    error EmailRecoveryDeadlineExpired(uint48 deadline);
    error EmailRecoveryPasskeyHashMismatch();
    error EmailRecoveryScopeHashMismatch();
    error EmailRecoveryChainNotInScope(uint256 chainId);
    error EmailRecoveryScopeWalletMismatch(address expected, address provided);
    error EmailRecoveryScopeModuleMismatch(address expected, address provided);
    error EmailRecoveryScopeNonceMismatch(uint256 expected, uint256 provided);
    error EmailRecoveryGuardianSetChanged();
    error EmailRecoveryPolicyChanged();

    uint256 private constant LEGACY_PASSKEY_INIT_PAYLOAD_LENGTH = 96;
    uint8 private constant EMAIL_RECOVERY_DATA_VERSION = 1;

    mapping(address account => uint256 nonce) private _emailRecoveryNonces;
    mapping(address account => bytes32 guardianSetHash) private _emailGuardianSetHashes;
    mapping(address account => bytes32 policyHash) private _emailPolicyHashes;

    constructor(
        address verifier,
        address dkimRegistry,
        address emailAuthImpl,
        address commandHandler,
        uint256 minimumDelay,
        address killSwitchAuthorizer
    ) EmailRecoveryManager(verifier, dkimRegistry, emailAuthImpl, commandHandler, minimumDelay, killSwitchAuthorizer) {}

    /*//////////////////////////////////////////////////////////////
                            MODULE LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes guardian configuration and timing parameters for the calling account.
     * @dev `data` must be abi.encoded as (guardians, weights, threshold, delay, expiry).
     */
    function onInstall(bytes calldata data) external override {
        if (data.length == 0) revert InvalidOnInstallData();
        (address[] memory guardians, uint256[] memory weights, uint256 threshold, uint256 delay, uint256 expiry) =
            abi.decode(data, (address[], uint256[], uint256, uint256, uint256));

        configureRecovery(guardians, weights, threshold, delay, expiry);

        _emailGuardianSetHashes[msg.sender] = keccak256(abi.encode(guardians, weights));
        _emailPolicyHashes[msg.sender] = _hashPolicy(threshold, delay, expiry);
    }

    /**
     * @notice Clears guardian state and pending recovery data for the calling account.
     */
    function onUninstall(
        bytes calldata /*data*/
    )
        external
        override
    {
        deInitRecoveryModule();
        delete _emailRecoveryNonces[msg.sender];
        delete _emailGuardianSetHashes[msg.sender];
        delete _emailPolicyHashes[msg.sender];
    }

    function isInitialized(address account) public view override returns (bool) {
        return getGuardianConfig(account).threshold != 0;
    }

    function canStartRecoveryRequest(address account) external view override returns (bool) {
        GuardianConfig memory guardianConfig = getGuardianConfig(account);

        return !killSwitchEnabled && guardianConfig.threshold > 0
            && guardianConfig.acceptedWeight >= guardianConfig.threshold && recoveryRequests[account].currentWeight == 0;
    }

    /*//////////////////////////////////////////////////////////////
                              RECOVERY FLOW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Executes the recovery by adding a new passkey on the target smart account.
     * @dev Legacy `recoveryData` is abi.encode(PasskeyInit). V1 multichain recovery data is
     *      abi.encode(uint8 version, PasskeyInit, RecoveryIntent, RecoveryModuleScope[]).
     */
    function recover(address account, bytes calldata recoveryData) internal override {
        if (recoveryData.length == LEGACY_PASSKEY_INIT_PAYLOAD_LENGTH) {
            PasskeyTypes.PasskeyInit memory legacyPasskey = abi.decode(recoveryData, (PasskeyTypes.PasskeyInit));
            _executePasskeyRecovery(account, legacyPasskey);
            return;
        }

        (
            uint8 dataVersion,
            PasskeyTypes.PasskeyInit memory newPasskey,
            RecoveryTypes.RecoveryIntent memory intent,
            RecoveryTypes.RecoveryModuleScope[] memory scopes
        ) = abi.decode(
            recoveryData,
            (uint8, PasskeyTypes.PasskeyInit, RecoveryTypes.RecoveryIntent, RecoveryTypes.RecoveryModuleScope[])
        );

        if (dataVersion != EMAIL_RECOVERY_DATA_VERSION) {
            revert InvalidEmailRecoveryDataVersion(dataVersion);
        }
        if (intent.deadline < block.timestamp) {
            revert EmailRecoveryDeadlineExpired(intent.deadline);
        }
        if (intent.newPasskeyHash != RecoveryHash.hashPasskeyInitMemory(newPasskey)) {
            revert EmailRecoveryPasskeyHashMismatch();
        }
        if (intent.chainScopeHash != RecoveryHash.hashChainScopesMemory(scopes)) {
            revert EmailRecoveryScopeHashMismatch();
        }

        _validateLocalScope(account, scopes);
        _executePasskeyRecovery(account, newPasskey);
        _emailRecoveryNonces[account] += 1;
    }

    function _executePasskeyRecovery(address account, PasskeyTypes.PasskeyInit memory newPasskey) private {
        if (newPasskey.idRaw == bytes32(0)) {
            revert InvalidPasskey(newPasskey.idRaw);
        }
        if (newPasskey.px == 0 || newPasskey.py == 0) {
            revert InvalidPasskeyCoordinates();
        }

        // SmartAccount enforces that only registered recovery modules may call this.
        IEmailRecoveryAccount(account).addPasskeyFromRecovery(newPasskey);

        emit RecoveryExecuted(account, newPasskey.idRaw);
    }

    function _validateLocalScope(address account, RecoveryTypes.RecoveryModuleScope[] memory scopes) private view {
        uint256 chainId = block.chainid;

        for (uint256 i = 0; i < scopes.length; i++) {
            RecoveryTypes.RecoveryModuleScope memory scope = scopes[i];
            if (scope.chainId != chainId) {
                continue;
            }

            if (scope.wallet != account) {
                revert EmailRecoveryScopeWalletMismatch(account, scope.wallet);
            }
            if (scope.recoveryModule != address(this)) {
                revert EmailRecoveryScopeModuleMismatch(address(this), scope.recoveryModule);
            }
            if (scope.nonce != _emailRecoveryNonces[account]) {
                revert EmailRecoveryScopeNonceMismatch(_emailRecoveryNonces[account], scope.nonce);
            }
            if (scope.guardianSetHash != _emailGuardianSetHashes[account]) {
                revert EmailRecoveryGuardianSetChanged();
            }
            if (scope.policyHash != _emailPolicyHashes[account]) {
                revert EmailRecoveryPolicyChanged();
            }

            return;
        }

        revert EmailRecoveryChainNotInScope(chainId);
    }

    function _hashPolicy(uint256 threshold, uint256 delay, uint256 expiry) private view returns (bytes32) {
        return keccak256(abi.encode(threshold, delay, expiry, commandHandler, address(this), uint256(1)));
    }

    /*//////////////////////////////////////////////////////////////
                                METADATA
    //////////////////////////////////////////////////////////////*/

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == TYPE_EXECUTOR;
    }

    function name() external pure returns (string memory) {
        return "Trezo.EmailRecovery";
    }

    function version() external pure returns (string memory) {
        return "1.0.0";
    }

    function recoveryDataHash(PasskeyTypes.PasskeyInit calldata newPasskey) external pure override returns (bytes32) {
        return keccak256(abi.encode(newPasskey));
    }

    function getRecoveryNonce(address account) external view override returns (uint256) {
        return _emailRecoveryNonces[account];
    }

    function getGuardianSetHash(address account) external view override returns (bytes32) {
        return _emailGuardianSetHashes[account];
    }

    function getPolicyHash(address account) external view override returns (bytes32) {
        return _emailPolicyHashes[account];
    }

    function multichainRecoveryDataHash(bytes calldata recoveryData) external pure override returns (bytes32) {
        return keccak256(recoveryData);
    }
}
