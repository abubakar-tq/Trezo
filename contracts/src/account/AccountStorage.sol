// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Namespaced, append-only storage for the Smart Account.
/// Keep this SLOT constant forever. Never reorder/remove existing fields.
/// Only append at the end + use __gap for future expansion.
library AccountStorage {
    // !!! NEVER CHANGE !!!
    bytes32 internal constant SLOT = keccak256("trezo.aa.smartaccount.storage");

    struct Layout {
        address owner; // EOA or module-governed owner
        address entryPoint; // ERC-4337 EntryPoint for this chain
        bool initialized; // Initialization flag to prevent re-initialization
        // Module registry (account-level view)
        mapping(address => bool) enabledModule;
        // --- reserve room for future vars to avoid shifting storage ---
        uint256[49] __gap;
    }

    function layout() internal pure returns (Layout storage s) {
        bytes32 slot = SLOT;
        assembly {
            s.slot := slot
        }
    }
}
