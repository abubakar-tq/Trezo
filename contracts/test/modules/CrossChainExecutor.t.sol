// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {CrossChainExecutor} from "src/modules/CrossChainExecutor.sol";
import {ICrossChainExecutor} from "src/modules/interfaces/ICrossChainExecutor.sol";

contract MockSwapRouter {
    bool public shouldFail;
    address public lastRecipient;
    uint256 public amountOutReturned = 1e18;

    function setShouldFail(bool v) external {
        shouldFail = v;
    }

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256) {
        require(!shouldFail, "router failed");
        lastRecipient = params.recipient;
        ERC20Mock(params.tokenOut).mint(params.recipient, amountOutReturned);
        return amountOutReturned;
    }
}

contract CrossChainExecutorTest is Test {
    address constant MOCK_SPOKE_POOL = address(0xAAAA);
    address internal user = address(0xBEEF);

    CrossChainExecutor internal executor;
    MockSwapRouter internal router;

    function setUp() public {
        router = new MockSwapRouter();
        executor = new CrossChainExecutor(MOCK_SPOKE_POOL, address(router));
    }

    function testConstructorSetsImmutables() public view {
        assertEq(executor.spokePool(), MOCK_SPOKE_POOL);
        assertEq(executor.swapRouter(), address(router));
    }

    function testRevertsWhenCallerIsNotSpokePool() public {
        vm.prank(address(0xCAFE));
        vm.expectRevert(ICrossChainExecutor.UnauthorizedCaller.selector);
        executor.handleV3AcrossMessage(address(0), 0, address(0), _msg(user, address(0), 0, 500, block.timestamp));
    }

    function testForwardsSameTokenWithoutSwap() public {
        ERC20Mock token = new ERC20Mock();
        token.mint(address(executor), 1_000e18);

        bytes memory message = _msg(user, address(token), 0, 500, block.timestamp + 1);

        vm.prank(MOCK_SPOKE_POOL);
        executor.handleV3AcrossMessage(address(token), 1_000e18, address(0xC0FFEE), message);

        assertEq(token.balanceOf(user), 1_000e18, "user should receive the full amount");
        assertEq(token.balanceOf(address(executor)), 0, "executor should hold no residual");
    }

    function testSwapsAndForwardsToRecipientOnSuccess() public {
        ERC20Mock sellToken = new ERC20Mock();
        ERC20Mock buyToken = new ERC20Mock();
        sellToken.mint(address(executor), 1_000e6);

        bytes memory message = _msg(user, address(buyToken), 1e17, 500, block.timestamp + 1);

        vm.prank(MOCK_SPOKE_POOL);
        executor.handleV3AcrossMessage(address(sellToken), 1_000e6, address(0xC0FFEE), message);

        assertEq(buyToken.balanceOf(user), 1e18, "user should receive swapped amount");
        assertEq(router.lastRecipient(), user, "router should be called with the user as recipient");
    }

    function testRefundsRecipientWhenSwapFails() public {
        ERC20Mock sellToken = new ERC20Mock();
        ERC20Mock buyToken = new ERC20Mock();
        sellToken.mint(address(executor), 1_000e6);
        router.setShouldFail(true);

        bytes memory message = _msg(user, address(buyToken), 1e17, 500, block.timestamp + 1);

        vm.prank(MOCK_SPOKE_POOL);
        executor.handleV3AcrossMessage(address(sellToken), 1_000e6, address(0xC0FFEE), message);

        assertEq(buyToken.balanceOf(user), 0, "user must not receive buyToken when swap fails");
        assertEq(sellToken.balanceOf(user), 1_000e6, "user should be refunded the bridged token");
    }

    function _msg(address recipient, address buyToken, uint256 minOut, uint24 fee, uint256 deadline)
        private
        pure
        returns (bytes memory)
    {
        return abi.encode(recipient, buyToken, minOut, fee, deadline);
    }
}
