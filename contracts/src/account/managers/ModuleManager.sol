// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@ERC7579/src/interfaces/IERC7579Module.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";

// ---------------------------------------------------------------------
// Internal libs
// ---------------------------------------------------------------------

/**
 * @dev Gas-efficient address set using swap-and-pop (order not preserved).
 *      Reference impls often use sentinel linked-lists; sets are simpler
 *      and cheaper for small registries (validators are few).
 */
library AddressSetLib {
    struct Set {
        address[] arr;
        mapping(address => uint256) idx; // 1-based; 0 = absent
    }

    function add(Set storage s, address a) internal returns (bool) {
        if (a == address(0) || s.idx[a] != 0) return false;
        s.arr.push(a);
        s.idx[a] = s.arr.length;
        return true;
    }

    function remove(Set storage s, address a) internal returns (bool) {
        uint256 i = s.idx[a];
        if (i == 0) return false;
        uint256 last = s.arr.length;
        if (i != last) {
            address tail = s.arr[last - 1];
            s.arr[i - 1] = tail;
            s.idx[tail] = i;
        }
        s.arr.pop();
        delete s.idx[a];
        return true;
    }

    function contains(Set storage s, address a) internal view returns (bool) {
        return s.idx[a] != 0;
    }

    function values(Set storage s) internal view returns (address[] memory out) {
        out = s.arr;
    }
}

/**
 * @title ModuleManager (ERC-7579-style; validators v1, exec/fallback-ready)
 * @notice Typed module manager that currently supports VALIDATORS. It follows the
 *         reference implementation shape with a separate, namespaced storage slot.
 * @dev
 *  - Exposes typed functions: installValidator / uninstallValidator / setActiveValidator.
 *  - Internal routing helpers for ERC-4337 + EIP-1271 (to active validator).
 *  - Ready to append Executors/Fallbacks later without shifting storage.
 *  - Functions are `onlyAccount`: must be invoked via a self-call from the Account,
 *    after signature validation in the 4337 flow (standard AA pattern).
 */
abstract contract ModuleManager {
    using AddressSetLib for AddressSetLib.Set;

    // ---------------------------------------------------------------------
    // Namespaced storage (separate slot, ERC-7579-style)
    // ---------------------------------------------------------------------

    /// @dev Unique slot for the manager’s state (separate from AccountStorage).
    ///      If you already use an EIP-7201 scheme, you can adapt this constant.
    ///      (This mirrors the reference approach of isolating per-feature state.)
    // keccak256("trezo.module-manager.storage.v1")
    bytes32 internal constant _SLOT = 0x6b9d70b7f7b9af8cfb8a6e74a7f7a1f9f0d3b6a9c4a7e5d2b1c0f9e8d7c6b5a4;

    struct Layout {
        // ---- VALIDATORS (live in v1) ----
        AddressSetLib.Set validators; // installed validator modules
        address activeValidator; // singleton active validator
        // ---- EXECUTORS (append later) ----
        // AddressSetLib.Set executors;
        // mapping(address => bool) executorMayDelegatecall;

        // ---- FALLBACKS (append later) ----
        // AddressSetLib.Set fallbacks;
        // address activeFallback;

        // Reserved gap for future variables
        uint256[48] __gap;
    }

    function _layout() private pure returns (Layout storage s) {
        bytes32 slot = _SLOT;
        assembly {
            s.slot := slot
        }
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    /// @notice Emitted when a validator is installed.
    event ValidatorInstalled(address indexed validator);

    /// @notice Emitted when a validator is uninstalled.
    event ValidatorUninstalled(address indexed validator);

    /// @notice Emitted when the active validator pointer updates.
    event ActiveValidatorChanged(address indexed previous, address indexed current);

   

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    /**
     * @notice Restrict execution to the Smart Account itself.
     * @dev Standard AA pattern: privileged ops are performed via a self-call
     *      after signature validation in the 4337 flow. See account snippet.
     */
    modifier onlyAccount() {
        require(msg.sender == address(this), "ModuleManager: ONLY_ACCOUNT");
        _;
    }

    // ---------------------------------------------------------------------
    // VALIDATORS — typed API (install/uninstall/activate)
    // ---------------------------------------------------------------------

    /**
     * @notice Install a validator module (does NOT make it active).
     * @param validator Validator module address (must implement IValidator).
     * @param init ABI-encoded initializer forwarded to validator.onInstall.
     *
     * @dev
     *  - Invoked by the Account via a self-call (onlyAccount).
     *  - Always uses `call` (never delegatecall) to keep validator isolated.
     */
    function installValidator(address validator, bytes calldata init) external onlyAccount {
        Layout storage S = _layout();
        require(validator != address(0), "MM: ZERO_ADDR");
        require(!S.validators.contains(validator), "MM: VALIDATOR_EXISTS");

        IValidator(validator).onInstall(init);
        bool ok = S.validators.add(validator);
        assert(ok);
        if(S.activeValidator == address(0)) {
            S.activeValidator = validator;
            emit ActiveValidatorChanged(address(0), validator);
        }
        emit ValidatorInstalled(validator);
    }

    /**
     * @notice Uninstall a validator (cannot be the active one).
     * @param validator Installed validator address.
     * @param data ABI-encoded data forwarded to validator.onUninstall.
     */
    function uninstallValidator(address validator, bytes calldata data) external onlyAccount {
        Layout storage S = _layout();
        require(S.validators.contains(validator), "MM: NOT_INSTALLED");
        require(validator != S.activeValidator, "MM: IS_ACTIVE");

        IValidator(validator).onUninstall(data);
        bool ok = S.validators.remove(validator);
        assert(ok);
        emit ValidatorUninstalled(validator);
    }

    /**
     * @notice Set the single active validator used for ERC-4337 + EIP-1271 routing.
     * @param validator Validator address (must be installed).
     */
    function setActiveValidator(address validator) external onlyAccount {
        Layout storage S = _layout();
        require(validator != address(0), "MM: ZERO_ADDR");
        require(S.validators.contains(validator), "MM: NOT_INSTALLED");
        address prev = S.activeValidator;
        S.activeValidator = validator;
        emit ActiveValidatorChanged(prev, validator);
    }

    // ---------------------------------------------------------------------
    // Views & routing helpers (Account calls these)
    // ---------------------------------------------------------------------

    /// @notice Return the active validator pointer.
    function activeValidator() public view returns (address) {
        return _layout().activeValidator;
    }

    /// @notice Return all installed validators (order not guaranteed).
    function listValidators() public view returns (address[] memory) {
        return _layout().validators.values();
    }

    /// @notice True if a validator is installed.
    function isValidatorInstalled(address validator) public view returns (bool) {
        return _layout().validators.contains(validator);
    }

    /**
     * @notice INTERNAL: route ERC-4337 validation to active validator.
     * @param userOp Encoded UserOperation (per your account’s packing).
     * @param userOpHash Hash used by validators (4337).
     * @return validationData Packed ERC-4337 ValidationData (uint256).
     */
    function _routeValidateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        returns (uint256 validationData)
    {
        address v = _layout().activeValidator;
        require(v != address(0), "MM: NO_ACTIVE_VALIDATOR");
        validationData = IValidator(v).validateUserOp(userOp, userOpHash);
    }

    /**
     * @notice INTERNAL: route EIP-1271 signature check to active validator.
     * @param hash Message hash.
     * @param sig  Validator-specific signature envelope.
     * @return magicValue 0x1626ba7e if valid.
     */
    function _routeIsValidSignature(bytes32 hash, bytes calldata sig) internal view returns (bytes4 magicValue) {
        address v = _layout().activeValidator;
        require(v != address(0), "MM: NO_ACTIVE_VALIDATOR");
        magicValue = IValidator(v).isValidSignatureWithSender(address(this), hash, sig);
    }


    // ---------------------------------------------------------------------
    // (Future) Executors & Fallbacks:
    //  - installExecutor/uninstallExecutor (+ optional delegatecall flag)
    //  - installFallback/uninstallFallback + setActiveFallback
    //  - Account's fallback() would delegatecall to active fallback handler
    // ---------------------------------------------------------------------
}
