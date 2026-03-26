// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/common/Types.sol";
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

    constructor(
        address verifier,
        address dkimRegistry,
        address emailAuthImpl,
        address commandHandler,
        uint256 minimumDelay,
        address killSwitchAuthorizer
    )
        EmailRecoveryManager(
            verifier,
            dkimRegistry,
            emailAuthImpl,
            commandHandler,
            minimumDelay,
            killSwitchAuthorizer
        )
    { }

    /*//////////////////////////////////////////////////////////////
                            MODULE LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initializes guardian configuration and timing parameters for the calling account.
     * @dev `data` must be abi.encoded as (guardians, weights, threshold, delay, expiry).
     */
    function onInstall(bytes calldata data) external override {
        if (data.length == 0) revert InvalidOnInstallData();
        (
            address[] memory guardians,
            uint256[] memory weights,
            uint256 threshold,
            uint256 delay,
            uint256 expiry
        ) = abi.decode(data, (address[], uint256[], uint256, uint256, uint256));

        configureRecovery(guardians, weights, threshold, delay, expiry);
    }

    /**
     * @notice Clears guardian state and pending recovery data for the calling account.
     */
    function onUninstall(bytes calldata /*data*/ ) external override {
        deInitRecoveryModule();
    }

    function isInitialized(address account) public view override returns (bool) {
        return getGuardianConfig(account).threshold != 0;
    }

    function canStartRecoveryRequest(address account) external view override returns (bool) {
        GuardianConfig memory guardianConfig = getGuardianConfig(account);

        return !killSwitchEnabled && guardianConfig.threshold > 0
            && guardianConfig.acceptedWeight >= guardianConfig.threshold
            && recoveryRequests[account].currentWeight == 0;
    }

    /*//////////////////////////////////////////////////////////////
                              RECOVERY FLOW
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Executes the recovery by adding a new passkey on the target smart account.
     * @dev `recoveryData` is expected to be abi.encode(PasskeyInit). The hash of this value
     *      must match the `recoveryDataHash` approved by guardians.
     */
    function recover(address account, bytes calldata recoveryData) internal override {
        PasskeyTypes.PasskeyInit memory newPasskey =
            abi.decode(recoveryData, (PasskeyTypes.PasskeyInit));

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

    function recoveryDataHash(PasskeyTypes.PasskeyInit calldata newPasskey)
        external
        pure
        override
        returns (bytes32)
    {
        return keccak256(abi.encode(newPasskey));
    }
}
