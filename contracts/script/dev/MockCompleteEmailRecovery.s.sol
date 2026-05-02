// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {EmailRecoveryHarness} from "test/harness/EmailRecoveryHarness.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {PasskeyTypes} from "src/common/Types.sol";

/**
 * @title MockCompleteEmailRecovery
 * @notice LOCAL-ONLY helper script to complete an email recovery on Anvil.
 *         Auto-reads harness and passkey validator addresses from deployment JSON.
 *         Hard-reverts on any chain that is not 31337, 31338, or 31339.
 *
 *         Required env vars:
 *           ACCOUNT          - the smart account address being recovered
 *           RECOVERY_DATA    - hex-encoded abi-encoded recovery data
 *
 *         Optional env vars (override auto-read):
 *           RECOVERY_HARNESS  - override harness address from deployment JSON
 *           PASSKEY_VALIDATOR - override passkey validator from deployment JSON
 *           NEW_PASSKEY_ID    - if set, verifies this specific passkey after completion
 */
contract MockCompleteEmailRecovery is Script {
    error NotLocalChain(uint256 chainId);
    error MissingDeployment(string field);

    uint256 internal constant LOCAL_CHAIN_1 = 31_337;
    uint256 internal constant LOCAL_CHAIN_2 = 31_338;
    uint256 internal constant LOCAL_CHAIN_3 = 31_339;

    modifier onlyLocal() {
        if (block.chainid != LOCAL_CHAIN_1 && block.chainid != LOCAL_CHAIN_2 && block.chainid != LOCAL_CHAIN_3) {
            revert NotLocalChain(block.chainid);
        }
        _;
    }

    function run() external onlyLocal {
        address account = vm.envAddress("ACCOUNT");
        bytes memory recoveryData = vm.envBytes("RECOVERY_DATA");

        address harnessAddr = _loadAddress("RECOVERY_HARNESS", ".emailRecovery");
        address validatorAddr = _loadAddress("PASSKEY_VALIDATOR", ".passkeyValidator");

        EmailRecoveryHarness harness = EmailRecoveryHarness(harnessAddr);
        EmailRecovery recovery = EmailRecovery(harnessAddr);

        (uint256 executeAfter, uint256 executeBefore, uint256 currentWeight, bytes32 storedHash) =
            recovery.getRecoveryRequest(account);

        console2.log("=== MockCompleteEmailRecovery (local only) ===");
        console2.log("chainId:", block.chainid);
        console2.log("Account:", account);
        console2.log("Harness (auto-read):", harnessAddr);
        console2.log("Validator (auto-read):", validatorAddr);
        console2.log("currentWeight:", currentWeight);
        console2.log("executeAfter:", executeAfter);
        console2.log("executeBefore:", executeBefore);
        console2.log("storedHash:");
        console2.logBytes32(storedHash);
        console2.log("recoveryDataHash:");
        console2.logBytes32(keccak256(recoveryData));

        if (storedHash != keccak256(recoveryData)) {
            console2.log("WARNING: recoveryData hash does not match stored recovery request hash!");
        }

        if (block.timestamp < executeAfter) {
            uint256 targetTime = executeAfter + 1;
            uint256 timeDelta = targetTime - block.timestamp;
            console2.log("Delay not yet passed, advancing Anvil clock...");
            console2.log("  current:", block.timestamp);
            console2.log("  target: ", targetTime);
            console2.log("  delta:  ", timeDelta);
            string memory rpcUrl = vm.envOr("ANVIL_RPC_URL", string("http://192.168.100.68:8545"));
            _advanceAnvilTime(timeDelta, rpcUrl);
            vm.warp(targetTime);
        }

        vm.startBroadcast();
        recovery.completeRecovery(account, recoveryData);
        vm.stopBroadcast();

        console2.log("Recovery completed successfully!");

        try vm.envBytes32("NEW_PASSKEY_ID") returns (bytes32 newPasskeyId) {
            PasskeyValidator validator = PasskeyValidator(validatorAddr);
            bool hasPasskey = validator.hasPasskey(account, PasskeyValidator.PasskeyId.wrap(newPasskeyId));
            if (hasPasskey) {
                console2.log("New passkey verified in PasskeyValidator.");
            } else {
                console2.log("WARNING: new passkey NOT found in PasskeyValidator.");
            }
        } catch {
            console2.log("NEW_PASSKEY_ID not set, skipping passkey verification.");
        }
    }

    function _loadAddress(string memory envName, string memory jsonPath) internal returns (address) {
        try vm.envAddress(envName) returns (address addr) {
            return addr;
        } catch {}
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        try vm.readFile(path) returns (string memory json) {
            return vm.parseJsonAddress(json, jsonPath);
        } catch {}
        revert MissingDeployment(envName);
    }

    function _advanceAnvilTime(uint256 delta, string memory rpcUrl) internal {
        string[] memory incrCmd = new string[](6);
        incrCmd[0] = "cast";
        incrCmd[1] = "rpc";
        incrCmd[2] = "evm_increaseTime";
        incrCmd[3] = vm.toString(delta);
        incrCmd[4] = "--rpc-url";
        incrCmd[5] = rpcUrl;
        vm.ffi(incrCmd);
        string[] memory mineCmd = new string[](4);
        mineCmd[0] = "cast";
        mineCmd[1] = "rpc";
        mineCmd[2] = "evm_mine";
        mineCmd[3] = rpcUrl;
        vm.ffi(mineCmd);
    }
}
