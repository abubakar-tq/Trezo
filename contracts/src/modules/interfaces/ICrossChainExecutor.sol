// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Receives Across V3 bridge proceeds on the destination chain and routes them
///         (optionally via Uniswap V3) to the user's smart account.
interface ICrossChainExecutor {
    error UnauthorizedCaller();

    event SwapExecuted(
        address indexed recipient, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut
    );
    event RefundIssued(address indexed recipient, address token, uint256 amount, string reason);

    /// @notice Decoded shape of the `message` payload supplied to Across SpokePool.depositV3.
    /// @dev abi.encode(recipient, buyToken, minOut, feeTier, deadline)
    struct BridgeMessage {
        address recipient;
        address buyToken;
        uint256 minOut;
        uint24 feeTier;
        uint256 deadline;
    }

    /// @notice Across V3 callback. Only callable by the configured SpokePool.
    function handleV3AcrossMessage(address tokenSent, uint256 amount, address relayer, bytes memory message)
        external;

    function spokePool() external view returns (address);
    function swapRouter() external view returns (address);
}
