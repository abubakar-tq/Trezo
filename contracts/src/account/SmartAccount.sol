// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAccount} from "lib/account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "lib/account-abstraction/contracts/core/Helpers.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {AccountStorage} from "./AccountStorage.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ModuleManager} from "src/account/managers/ModuleManager.sol";
import {PasskeyTypes} from "src/modules/Types.sol";
import "@ERC7579/src/interfaces/IERC7579Module.sol";

contract SmartAccount is IAccount, ModuleManager {
    using AccountStorage for AccountStorage.Layout;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event ModuleInstalled(uint256 moduleTypeId, address module);
    event ModuleUninstalled(uint256 moduleTypeId, address module);
    event AccountInitialized(address entryPoint, bytes32 passKeyId);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error MinimalAccount__NotFromEntryPoint();
    // error MinimalAccount__NotFromEntryPointOrOwner();
    error MinimalAccount__CallFailed(bytes);
    error AlreadyInitialized();
    error ZeroAddress();
    error SMARTACCOUNT_INITIALIZATION_FAILED(bytes reason);

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier requireFromEntryPoint() {
        if (msg.sender != AccountStorage.layout().entryPoint) {
            revert MinimalAccount__NotFromEntryPoint();
        }
        _;
    }
    /// @notice Modifier for admin-only functions that MUST be invoked via a self-call.
    /// @dev  For Admin functions will only be called by the account itself

    modifier onlySelf() {
        require(msg.sender == address(this), "Account: ONLY_ACCOUNT");
        _;
    }

    // Modifier for future modular access control (e.g., via modules)
    // function modifierModuleOrEntryPoint() internal view {}

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev For receiving the ether
     */
    receive() external payable {}

    constructor() {
        // Disable initializer on the implementation itself.
        AccountStorage.Layout storage s = AccountStorage.layout();
        s.initialized = true;
    }

    /*//////////////////////////////////////////////////////////////
                                EXTERNAL
    //////////////////////////////////////////////////////////////*/

    /**
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds The amount of funds that are missing from the account
     * @dev This function validates the user operation by checking the signature and paying the missing funds
     * @dev This must be called from the entry point
     * @return validationData The validation data
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        requireFromEntryPoint
        returns (uint256 validationData)
    {
        //this will be called by entrypoint.sol so you have to check the validity of the user operation

        validationData = _routeValidateUserOp(userOp, userOpHash);

        _payPrefund(missingAccountFunds);
    }

    /**
     * @param dest The address of the destination contract
     * @param value The amount of Ether to send
     * @param functionData The data to send to the destination contract
     * @dev This function can be called by the entry point or authorized modules (future extension)
     */
    function execute(address dest, uint256 value, bytes calldata functionData) external requireFromEntryPoint {
        (bool success, bytes memory result) = dest.call{value: value}(functionData);
        if (!success) {
            revert MinimalAccount__CallFailed(result);
        }
    }

    // ---------------------------------------------------------------------
    //  ERC-7579 Specific
    // ---------------------------------------------------------------------

    /**
     * @notice Generic module installer that routes to the typed function.
     * @dev Follow the reference: the Account exposes a generic entry that dispatches
     *      to the correct typed install based on ModuleType. For v1 we only implement
     *      VALIDATION path; EXECUTION/FALLBACK are no-ops or revert.
     *
     * @param moduleType  The numeric module type (e.g., VALIDATION=1 in ref impl).
     * @param module      Module address to install.
     * @param init        ABI-encoded initializer forwarded to the module.
     *
     * Requirements:
     *  - Must be invoked via a self-call after validator-based auth (onlySelf).
     */
    function installModule(uint256 moduleType, address module, bytes calldata init) external onlySelf {
        // If you import the constants from the reference, do:
        // if (moduleType == MODULE_TYPE_VALIDATION) { this.installValidator(module, init); }
        // else if (moduleType == MODULE_TYPE_EXECUTION) { /* this.installExecutor(...) */ }
        // else if (moduleType == MODULE_TYPE_FALLBACK)  { /* this.installFallback(...) */ }
        // else { revert("Account: UNKNOWN_MODULE_TYPE"); }

        // For now (validators only):
        // Accept only the validator type value you use in your SDK (e.g., 1).
        require(moduleType == 1, "Account: ONLY_VALIDATION_SUPPORTED");
        this.installValidator(module, init); // external call => msg.sender becomes address(this) in manager
        emit ModuleInstalled(moduleType, module);
    }

    /**
     * @notice Generic module uninstaller that routes to the typed function.
     * @param moduleType The numeric module type.
     * @param module     Module address to uninstall.
     * @param data       ABI-encoded data for module.onUninstall.
     */
    function uninstallModule(uint256 moduleType, address module, bytes calldata data) external onlySelf {
        require(moduleType == 1, "Account: ONLY_VALIDATION_SUPPORTED");
        this.uninstallValidator(module, data);
        emit ModuleUninstalled(moduleType, module);
    }

    /**
     * @notice Set the active validator through a typed entry.
     * @param validator Installed validator to activate.
     */
    function setActiveValidatorFromAccount(address validator) external onlySelf {
        this.setActiveValidator(validator);
    }

    /**
     * @param hash The hash of the data to verify
     * @param data The data to verify
     */
    function isValidSignature(bytes32 hash, bytes calldata data) external view returns (bytes4) {
        return _routeIsValidSignature(hash, data);
    }

    function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata /*additionalContext*/ )
        external
        view
        returns (bool)
    {
        if (moduleTypeId == 1) {
            return isValidatorInstalled(module);
        } else {
            revert("Not Installed");
        }
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @dev The signature will be valid only if it was signed by an authorized module (future extension)
     * @dev The function will return SIG_VALIDATION_SUCCESS if the signature is valid, and SIG_VALIDATION_FAILED otherwise
     * @return validationData The validation data
     */
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        returns (uint256 validationData)
    {
        // TODO: Replace with modular signature validation
        return _routeValidateUserOp(userOp, userOpHash);
    }

    /**
     * @param missingAccountFunds The amount of funds that are missing from the account
     * @dev This function attempts to pay the missing funds to the account.
     */
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds != 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds, gas: type(uint256).max}("");
            (success);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/
    function getEntryPoint() external view returns (address) {
        return AccountStorage.layout().entryPoint;
    }

    function getNonce(uint192 key) external view returns (uint256) {
        return IEntryPoint(AccountStorage.layout().entryPoint).getNonce(address(this), key);
    }

    function getInitialized() external view returns (bool) {
        return AccountStorage.layout().initialized;
    }

    // function getOwner() external pure returns (address) {
    //     return address(0);
    // }

    /*//////////////////////////////////////////////////////////////
                            Initializer FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Initialize clone with entryPoint, attach passkey validator, and register first passkey
    /// @param _entryPoint ERC-4337 entry point
    /// @param validator address of the Passkey validator module for this account
    /// @param passkey PasskeyInit containing idRaw + (px,py,rpIdHash,signCounterFromAuth)
    function initialize(address _entryPoint, address validator, PasskeyTypes.PasskeyInit calldata passkey) external {
        AccountStorage.Layout storage s = AccountStorage.layout();
        if (s.initialized) revert AlreadyInitialized();
        if (_entryPoint == address(0) || validator == address(0)) revert ZeroAddress();

        // 1) set core AA wiring
        s.entryPoint = _entryPoint;

        // 2) install the PasskeyValidator module
        // Note: this calls the module's onInstall() which registers the initial passkey
        try this.installModule(MODULE_TYPE_VALIDATOR, validator, abi.encode(passkey)) {
            // ok
        } catch (bytes memory reason) {
            revert SMARTACCOUNT_INITIALIZATION_FAILED(reason);
        }

        // 4) finalize
        s.initialized = true;

        // emit events for indexers if you have them
        // emit Initialized(_entryPoint, validator, passkey.idRaw);
        emit AccountInitialized(_entryPoint, passkey.idRaw);
    }

    // a no-op example function just to prove delegatecall works
    function ping() external view returns (bytes32 who) {
        return (blockhash(block.number - 1));
    }
}
