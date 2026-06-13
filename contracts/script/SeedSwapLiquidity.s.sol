// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

interface IUniswapV3Pool {
    function liquidity() external view returns (uint128);
}

/// @notice Idempotent LP top-up script. Reads the pool address from the per-chain
///         deployment manifest, queries existing liquidity, and only seeds when
///         the pool is below the configured threshold. Today the seed branch
///         only logs the next ops step — full mint via NonfungiblePositionManager
///         is deferred because testnet WETH wrapping varies per chain.
contract SeedSwapLiquidity is Script {
    uint128 internal constant MIN_LIQUIDITY_THRESHOLD = 1e15;

    function run() external view {
        string memory profile = vm.envOr("DEPLOYMENT_PROFILE", vm.toString(block.chainid));
        string memory manifestPath = string.concat("deployments/", profile, ".json");
        string memory existing = vm.readFile(manifestPath);
        address pool = vm.parseJsonAddress(existing, ".swapPoolWethUsdc");

        uint128 liq = pool.code.length == 0 ? 0 : IUniswapV3Pool(pool).liquidity();
        if (liq >= MIN_LIQUIDITY_THRESHOLD) {
            console2.log("Pool already healthy. Skipping seed.");
            console2.log("pool:", pool);
            console2.log("liquidity:", uint256(liq));
            return;
        }

        console2.log("Pool below threshold. Manual LP required.");
        console2.log("pool:", pool);
        console2.log("liquidity:", uint256(liq));
        console2.log("Follow the chain-specific runbook in infra/relayer/README.md");
        console2.log("to mint a WETH/USDC position via NonfungiblePositionManager.");
    }
}
