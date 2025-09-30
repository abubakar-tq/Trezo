// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title AccountStorage
 * @notice Centralized, namespaced storage layout for the Trezo Smart Account.
 * @dev The storage layout is intentionally consolidated to simplify module
 *      management. Refrain from reordering fields once in production.
 */
library AccountStorage {

    // keccak256("trezo.smart-account.storage.v1")
    bytes32 internal constant SLOT = 0xc451fefb44c7d36ac68c4f53928477540b9d232aba5b44d987dc30ab3361d5af;

    struct Layout {
        address entryPoint;
        bool initialized;
    
        // --- reserve room for future vars to avoid shifting storage ---
        uint256[50] __gap;
    }

    function layout() internal pure returns (Layout storage s) {
        bytes32 slot = SLOT;
        assembly {
            s.slot := slot
        }
    }
}
