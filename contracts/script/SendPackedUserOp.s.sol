// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {DevOpsTools} from "lib/foundry-devops/src/DevOpsTools.sol";

import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";

contract SendPackedUserOp is Script {
    using MessageHashUtils for bytes32;

    address constant RANDOM_APPROVER = 0x8943F7348E2559C6E69eeCb0dA932424C3E6dC66;

    function run() public {
        // Setup
        HelperConfig helperConfig = new HelperConfig();
        address dest =  helperConfig.getConfig().usdc; 
        uint256 value = 0;
        address minimalAccountAddress = DevOpsTools.get_most_recent_deployment("SmartAccount", block.chainid);

        bytes memory functionData = abi.encodeWithSelector(IERC20.approve.selector, RANDOM_APPROVER, 1e18);
        bytes memory executeCalldata = abi.encodeWithSelector(SmartAccount.execute.selector, dest, value, functionData);
        PackedUserOperation memory userOp =
            generateSignedUserOperation(executeCalldata, helperConfig.getConfig(), minimalAccountAddress);
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        // Send transaction
        vm.startBroadcast();
        IEntryPoint(helperConfig.getConfig().entryPoint).handleOps(ops, payable(helperConfig.getConfig().account));
        vm.stopBroadcast();
    }

    function generateSignedUserOperation(
        bytes memory callData,
        HelperConfig.NetworkConfig memory config,
        address smartAccount
    ) public view returns (PackedUserOperation memory) {
        // 1. Generate the unsigned data
        uint256 nonce = IEntryPoint(config.entryPoint).getNonce(smartAccount, 0);
        PackedUserOperation memory userOp = _generateUnsignedUserOperation(callData, smartAccount, nonce);

        // 2. Get the userOp Hash
        bytes32 digest = IEntryPoint(config.entryPoint).getUserOpHash(userOp);
       

        // 3. Sign it
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 ANVIL_DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == 31337) {
            (v, r, s) = vm.sign(ANVIL_DEFAULT_KEY, digest);
        } else {
            (v, r, s) = vm.sign(config.account, digest);
        }
        userOp.signature = abi.encodePacked(r, s, v);
        return userOp;
    }

    function _generateUnsignedUserOperation(bytes memory callData, address sender, uint256 nonce)
        public
        pure
        returns (PackedUserOperation memory)
    {
        uint128 verificationGasLimit = 36777216;
        uint128 callGasLimit = verificationGasLimit;
        uint128 maxPriorityFeePerGas = 456;
        uint128 maxFeePerGas = maxPriorityFeePerGas;
        return PackedUserOperation({
            sender: sender,
            nonce: nonce,
            initCode: hex"",
            callData: callData,
            accountGasLimits: bytes32(uint256(verificationGasLimit) << 128 | callGasLimit),
            preVerificationGas: verificationGasLimit,
            gasFees: bytes32(uint256(maxPriorityFeePerGas) << 128 | maxFeePerGas),
            paymasterAndData: hex"",
            signature: hex""
        });
    }
}