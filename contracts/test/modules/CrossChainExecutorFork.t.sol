// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {CrossChainExecutor} from "src/modules/CrossChainExecutor.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

/// @notice Forked Base Sepolia test that exercises CrossChainExecutor against
///         the live Uniswap V3 SwapRouter02 and USDC/WETH pool.
///
///         Opt-in: requires `BASE_SEPOLIA_RPC_URL` in the environment. Without
///         it the tests skip — keeps unit-test runs fast and offline.
///
///         Run with:
///           BASE_SEPOLIA_RPC_URL=<rpc> forge test --match-contract CrossChainExecutorFork -vvv
contract CrossChainExecutorForkTest is Test {
    // ── Base Sepolia pins (mirror dexRegistry.ts + AcrossConfig.sol) ─────────
    address internal constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant SWAP_ROUTER_02 = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;
    uint24 internal constant POOL_FEE_TIER = 3000; // 0.30% — the healthchecked pool on Base Sepolia
    address internal constant POOL_USDC_WETH = 0x46880b404CD35c165EDdefF7421019F8dD25F4Ad;

    address internal constant USER = address(0xBEEF);
    address internal constant SPOKE_POOL = address(0xCAFE); // doesn't have to be the real SpokePool — we vm.prank it
    address internal constant RELAYER = address(0xC0FFEE);

    CrossChainExecutor internal executor;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            // No RPC -> skip silently. Foundry doesn't have a first-class skip(),
            // so we leave `forked` false and each test early-returns.
            return;
        }
        vm.createSelectFork(rpc);
        forked = true;
        executor = new CrossChainExecutor(SPOKE_POOL, SWAP_ROUTER_02);
    }

    /// @dev Forwards canonical USDC to the user untouched when buyToken == tokenSent.
    function testFork_forwardSameTokenWithoutSwap() public {
        if (!forked) return;
        uint256 amount = 1_000_000; // 1 USDC (6 decimals)
        deal(USDC, address(executor), amount);

        bytes memory message = abi.encode(USER, USDC, uint256(0), POOL_FEE_TIER, block.timestamp + 1 hours);

        vm.prank(SPOKE_POOL);
        executor.handleV3AcrossMessage(USDC, amount, RELAYER, message);

        assertEq(IERC20(USDC).balanceOf(USER), amount, "user should receive the canonical USDC untouched");
        assertEq(IERC20(USDC).balanceOf(address(executor)), 0, "executor should hold no residual USDC");
    }

    /// @dev USDC -> WETH swap via the live SwapRouter02 against the healthchecked pool.
    function testFork_swapUsdcToWeth() public {
        if (!forked) return;
        uint256 amount = 1_000_000; // 1 USDC
        deal(USDC, address(executor), amount);

        // minOut = 1 wei — we want the swap to succeed regardless of price action.
        // For a real client, minOut comes from BridgeDestQuoteService with slippage.
        bytes memory message = abi.encode(USER, WETH, uint256(1), POOL_FEE_TIER, block.timestamp + 1 hours);

        uint256 wethBefore = IERC20(WETH).balanceOf(USER);

        vm.prank(SPOKE_POOL);
        executor.handleV3AcrossMessage(USDC, amount, RELAYER, message);

        uint256 wethAfter = IERC20(WETH).balanceOf(USER);
        assertGt(wethAfter - wethBefore, 0, "user should receive a non-zero WETH amount");
        assertEq(IERC20(USDC).balanceOf(address(executor)), 0, "executor should hold no residual USDC");
    }

    /// @dev When minOut is set high enough that exactInputSingle will revert, the executor
    ///      refunds the canonical bridged USDC to the user instead of holding it.
    function testFork_refundsWhenSwapRevertsOnHighMinOut() public {
        if (!forked) return;
        uint256 amount = 1_000_000; // 1 USDC
        deal(USDC, address(executor), amount);

        // minOut = 100 WETH for 1 USDC will revert the router with "Too little received"
        bytes memory message = abi.encode(USER, WETH, uint256(100 ether), POOL_FEE_TIER, block.timestamp + 1 hours);

        vm.prank(SPOKE_POOL);
        executor.handleV3AcrossMessage(USDC, amount, RELAYER, message);

        assertEq(IERC20(WETH).balanceOf(USER), 0, "user must not receive WETH on swap failure");
        assertEq(IERC20(USDC).balanceOf(USER), amount, "user should be refunded the full USDC amount");
        assertEq(IERC20(USDC).balanceOf(address(executor)), 0, "executor should hold no residual USDC");
    }
}
