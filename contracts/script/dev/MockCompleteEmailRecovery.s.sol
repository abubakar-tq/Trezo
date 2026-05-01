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
 * @notice LOCAL-ONLY helper script to manually complete an email recovery on Anvil.
 *         Hard-reverts on any chain that is not 31337, 31338, or 31339.
 *
 *         This script loads the harness address and recovery data from environment
 *         variables, then calls completeRecovery(account, recoveryData) on the
 *         EmailRecoveryHarness. It optionally verifies the new passkey was stored.
 *
 *         Required env vars:
 *           ACCOUNT          - the smart account address being recovered
 *           RECOVERY_HARNESS - the deployed EmailRecoveryHarness address
 *           RECOVERY_DATA    - hex-encoded abi-encoded recovery data
 *
 *         Optional env vars:
 *           PASSKEY_VALIDATOR - if set, verifies the new passkey after completion
 *           NEW_PASSKEY_ID    - if set with PASSKEY_VALIDATOR, checks this specific passkey
 */
contract MockCompleteEmailRecovery is Script {
    error NotLocalChain(uint256 chainId);
    error MissingRequiredEnv(string param);

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
        address harnessAddr = vm.envAddress("RECOVERY_HARNESS");
        bytes memory recoveryData = vm.envBytes("RECOVERY_DATA");

        EmailRecoveryHarness harness = EmailRecoveryHarness(harnessAddr);
        EmailRecovery recovery = EmailRecovery(harnessAddr);

        (uint256 executeAfter, uint256 executeBefore, uint256 currentWeight, bytes32 storedHash) =
            recovery.getRecoveryRequest(account);

        console2.log("=== MockCompleteEmailRecovery (local only) ===");
        console2.log("chainId:", block.chainid);
        console2.log("Account:", account);
        console2.log("Harness:", harnessAddr);
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
            console2.log("WARNING: delay not yet passed, warping...");
            vm.warp(executeAfter + 1);
        }

        vm.startBroadcast();
        recovery.completeRecovery(account, recoveryData);
        vm.stopBroadcast();

        console2.log("Recovery completed successfully!");

        try vm.envAddress("PASSKEY_VALIDATOR") returns (address validatorAddr) {
            bytes32 newPasskeyId = vm.envBytes32("NEW_PASSKEY_ID");
            PasskeyValidator validator = PasskeyValidator(validatorAddr);
            bool hasPasskey = validator.hasPasskey(account, PasskeyValidator.PasskeyId.wrap(newPasskeyId));
            if (hasPasskey) {
                console2.log("New passkey verified in PasskeyValidator.");
            } else {
                console2.log("WARNING: new passkey NOT found in PasskeyValidator.");
            }
        } catch {
            console2.log("PASSKEY_VALIDATOR not set, skipping passkey verification.");
        }
    }
}
