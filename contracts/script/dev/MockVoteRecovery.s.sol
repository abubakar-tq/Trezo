// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {EmailRecoveryHarness} from "test/harness/EmailRecoveryHarness.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";
import {IGuardianManager} from "lib/email-recovery/src/interfaces/IGuardianManager.sol";

/**
 * @title MockVoteRecovery
 * @notice LOCAL-ONLY helper script to simulate guardian votes for a recovery request
 *         on the EmailRecoveryHarness. Auto-reads harness address from deployment JSON.
 *
 *         Hard-reverts on any chain that is not 31337, 31338, or 31339.
 *
 *         Required env vars:
 *           ACCOUNT          - the smart account address being recovered
 *           RECOVERY_DATA    - hex-encoded abi-encoded recovery data
 *
 *         Optional env vars (override auto-read):
 *           RECOVERY_HARNESS - override harness address from deployment JSON
 *           VOTE_COUNT       - number of guardians to vote (default: all)
 *           RECOVERY_TEMPLATE_IDX - template index for recovery command (default: 0)
 */
contract MockVoteRecovery is Script {
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
        uint256 voteCount = vm.envOr("VOTE_COUNT", uint256(0));
        uint256 templateIdx = vm.envOr("RECOVERY_TEMPLATE_IDX", uint256(0));

        address harnessAddr = _loadAddress("RECOVERY_HARNESS", ".emailRecovery");

        EmailRecoveryHarness harness = EmailRecoveryHarness(harnessAddr);
        EmailRecovery recovery = EmailRecovery(harnessAddr);

        bytes32 recoveryHash = keccak256(recoveryData);

        IGuardianManager.GuardianConfig memory config = recovery.getGuardianConfig(account);
        address[] memory guardians = recovery.getAllGuardians(account);

        (uint256 executeAfter, uint256 executeBefore, uint256 currentWeight, bytes32 storedHash) =
            recovery.getRecoveryRequest(account);

        console2.log("=== MockVoteRecovery (local only) ===");
        console2.log("chainId:", block.chainid);
        console2.log("Account:", account);
        console2.log("Harness (auto-read):", harnessAddr);
        console2.log("recoveryDataHash:");
        console2.logBytes32(recoveryHash);
        console2.log("Threshold:", config.threshold);
        console2.log("Current vote weight:", currentWeight);
        console2.log("Existing stored hash:");
        console2.logBytes32(storedHash);

        uint256 toVote = voteCount > 0 ? voteCount : guardians.length;
        if (toVote > guardians.length) {
            toVote = guardians.length;
        }

        string memory accountString = Strings.toHexString(uint160(account));
        string memory recoveryHashString = Strings.toHexString(uint256(recoveryHash));

        bytes[] memory commandParams = new bytes[](2);
        commandParams[0] = abi.encode(account);
        commandParams[1] = abi.encode(recoveryHashString);

        vm.startBroadcast();
        for (uint256 i = 0; i < toVote; i++) {
            console2.log("Voting guardian", i, ":");
            console2.logAddress(guardians[i]);
            harness.exposedProcessRecovery(guardians[i], templateIdx, commandParams);
        }
        vm.stopBroadcast();

        (executeAfter, executeBefore, currentWeight, storedHash) =
            recovery.getRecoveryRequest(account);

        console2.log("=== Voting Complete ===");
        console2.log("Current vote weight:", currentWeight);
        console2.log("Threshold:", config.threshold);
        console2.log("Stored recovery hash:");
        console2.logBytes32(storedHash);

        if (currentWeight >= config.threshold) {
            console2.log("Threshold reached!");
            console2.log("Execute after:", executeAfter);
            console2.log("Execute before:", executeBefore);
            if (block.timestamp < executeAfter) {
                console2.log("Timelock NOT yet passed. Warp time past:", executeAfter);
            } else {
                console2.log("Timelock passed. Ready for completeRecovery().");
            }
        } else {
            console2.log("Threshold NOT yet reached.");
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
}
