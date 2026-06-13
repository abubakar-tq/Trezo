// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Per-chain Across V3 SpokePool and Uniswap V3 SwapRouter02 lookups.
/// @dev SpokePool addresses are placeholders pending verification — see
///      docs/superpowers/plans/2026-05-11-testnet-deployment.md Task 27.
///      `CheckSpokePool.s.sol` MUST be run as a pre-flight before any deploy.
library AcrossConfig {
    // === Across V3 SpokePool addresses (PLACEHOLDERS — pin from across-protocol/contracts) ===
    address internal constant SPOKEPOOL_SEPOLIA = 0x5ef6C01E11889d86803e0B23e3cB3F9E9d97B662;
    address internal constant SPOKEPOOL_BASE_SEPOLIA = 0x82B564983aE7274c86695917BBf8C99ECb6F0F8F;
    address internal constant SPOKEPOOL_ARB_SEPOLIA = 0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75;
    address internal constant SPOKEPOOL_ANVIL_PLACEHOLDER = address(0);

    // === Uniswap V3 SwapRouter02 ===
    address internal constant SWAP_ROUTER_SEPOLIA = 0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E;
    address internal constant SWAP_ROUTER_BASE_SEPOLIA = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;
    address internal constant SWAP_ROUTER_ARB_SEPOLIA = 0x101F443B4d1b059569D643917553c771E1b9663E;

    /// @notice Returns the Across SpokePool for `chainId`, or `address(0)` if unknown.
    /// @dev Callers gate CrossChainExecutor deployment on a non-zero result.
    function spokePool(uint256 chainId) internal pure returns (address) {
        if (chainId == 11_155_111) return SPOKEPOOL_SEPOLIA;
        if (chainId == 84_532) return SPOKEPOOL_BASE_SEPOLIA;
        if (chainId == 421_614) return SPOKEPOOL_ARB_SEPOLIA;
        if (chainId == 31_337) return SPOKEPOOL_ANVIL_PLACEHOLDER;
        return address(0);
    }

    /// @notice Returns the Uniswap V3 SwapRouter02 for `chainId`, or `address(0)` if unknown.
    function swapRouter(uint256 chainId) internal pure returns (address) {
        if (chainId == 11_155_111) return SWAP_ROUTER_SEPOLIA;
        if (chainId == 84_532) return SWAP_ROUTER_BASE_SEPOLIA;
        if (chainId == 421_614) return SWAP_ROUTER_ARB_SEPOLIA;
        if (chainId == 31_337) return SWAP_ROUTER_SEPOLIA;
        return address(0);
    }

    /// @notice True when this chain has both a known SpokePool and SwapRouter,
    ///         and CrossChainExecutor should be deployed there.
    function hasExecutor(uint256 chainId) internal pure returns (bool) {
        return spokePool(chainId) != address(0) && swapRouter(chainId) != address(0);
    }
}
