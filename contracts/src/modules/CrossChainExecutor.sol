// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICrossChainExecutor} from "./interfaces/ICrossChainExecutor.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";

/// @title CrossChainExecutor
/// @notice Destination-chain handler for Trezo cross-chain swaps. Receives Across V3
///         bridge proceeds, decodes the embedded BridgeMessage, swaps the bridged
///         token into the user's chosen buyToken via Uniswap V3, and forwards to the
///         user's smart account. Falls back to forwarding the raw bridged token if
///         the destination-side swap fails.
contract CrossChainExecutor is ICrossChainExecutor {
    address public immutable override spokePool;
    address public immutable override swapRouter;

    constructor(address _spokePool, address _swapRouter) {
        spokePool = _spokePool;
        swapRouter = _swapRouter;
    }

    /// @inheritdoc ICrossChainExecutor
    function handleV3AcrossMessage(
        address tokenSent,
        uint256 amount,
        address, /* relayer */
        bytes memory message
    ) external override {
        if (msg.sender != spokePool) revert UnauthorizedCaller();

        BridgeMessage memory bridge = _decode(message);

        if (bridge.buyToken == tokenSent) {
            IERC20(tokenSent).transfer(bridge.recipient, amount);
            emit SwapExecuted(bridge.recipient, tokenSent, tokenSent, amount, amount);
            return;
        }

        IERC20(tokenSent).approve(swapRouter, amount);
        try ISwapRouter(swapRouter).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenSent,
                tokenOut: bridge.buyToken,
                fee: bridge.feeTier,
                recipient: bridge.recipient,
                deadline: bridge.deadline,
                amountIn: amount,
                amountOutMinimum: bridge.minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 amountOut) {
            emit SwapExecuted(bridge.recipient, tokenSent, bridge.buyToken, amount, amountOut);
        } catch {
            IERC20(tokenSent).transfer(bridge.recipient, amount);
            emit RefundIssued(bridge.recipient, tokenSent, amount, "swap failed");
        }
    }

    function _decode(bytes memory data) private pure returns (BridgeMessage memory bridge) {
        (bridge.recipient, bridge.buyToken, bridge.minOut, bridge.feeTier, bridge.deadline) =
            abi.decode(data, (address, address, uint256, uint24, uint256));
    }
}
