// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AcrossConfig} from "./common/AcrossConfig.sol";

/// @notice Pre-flight check that the Across V3 SpokePool exists at the pinned
///         address for the active chain. Halts deploys when the pin is stale.
contract CheckSpokePool is Script {
    error SpokePoolMissing(address expected, uint256 chainId);

    function run() external view returns (bool ok) {
        address pool = AcrossConfig.spokePool(block.chainid);
        ok = pool != address(0) && pool.code.length != 0;

        console2.log("chainId:", block.chainid);
        console2.log("Across SpokePool:", pool);
        console2.log("exists:", ok);

        if (!ok) revert SpokePoolMissing(pool, block.chainid);
    }
}
