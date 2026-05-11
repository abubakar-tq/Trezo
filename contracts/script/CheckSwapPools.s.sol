// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

interface IUniswapV3Pool {
    function liquidity() external view returns (uint128);
}

/// @notice Reads the per-chain deployment manifest, probes Uniswap V3 pool
///         liquidity, and writes a `swapSupported` boolean back into the
///         manifest. Mobile config reads that flag to enable/disable the
///         Swap action per chain.
contract CheckSwapPools is Script {
    function run() external returns (bool healthy) {
        string memory profile = vm.envOr("DEPLOYMENT_PROFILE", vm.toString(block.chainid));
        string memory manifestPath = string.concat("deployments/", profile, ".json");
        string memory existing = vm.readFile(manifestPath);

        address pool;
        try vm.parseJsonAddress(existing, ".swapPoolWethUsdc") returns (address parsed) {
            pool = parsed;
        } catch {
            console2.log("No swapPoolWethUsdc pinned in", manifestPath);
            console2.log("Set it after running healthcheck once with a verified pool address.");
            return false;
        }

        uint128 liq = pool.code.length == 0 ? 0 : IUniswapV3Pool(pool).liquidity();
        healthy = liq > 0;

        console2.log("chainId:", block.chainid);
        console2.log("pool:", pool);
        console2.log("liquidity:", uint256(liq));
        console2.log("healthy:", healthy);

        string memory root = "swapHealth";
        vm.serializeBool(root, "swapSupported", healthy);
        string memory updated = vm.serializeUint(root, "swapHealthcheckAt", block.timestamp);
        vm.writeJson(updated, manifestPath, ".swapSupported");
    }
}
