// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {EmailRecoveryHarness} from "test/harness/EmailRecoveryHarness.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";
import {IGuardianManager} from "lib/email-recovery/src/interfaces/IGuardianManager.sol";

/**
 * @title MockAcceptGuardians
 * @notice LOCAL-ONLY helper script to accept guardians on the EmailRecoveryHarness.
 *         Hard-reverts on any chain that is not 31337, 31338, or 31339.
 *
 *         Auto-reads the harness address from deployments/{chainId}.json.
 *
 *         Required env vars:
 *           ACCOUNT          - the smart account address with email recovery configured
 *
 *         Optional env vars (override auto-read):
 *           RECOVERY_HARNESS - override the harness address from deployment JSON
 *           GUARDIAN_COUNT   - number of guardians to accept (default: all)
 *           ACCEPTANCE_TEMPLATE_IDX - template index (default: 0)
 */
contract MockAcceptGuardians is Script {
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
        uint256 maxAccept = vm.envOr("GUARDIAN_COUNT", uint256(0));
        uint256 templateIdx = vm.envOr("ACCEPTANCE_TEMPLATE_IDX", uint256(0));

        address harnessAddr = _loadAddress("RECOVERY_HARNESS", ".emailRecovery");

        EmailRecoveryHarness harness = EmailRecoveryHarness(harnessAddr);
        EmailRecovery recovery = EmailRecovery(harnessAddr);

        IGuardianManager.GuardianConfig memory config = recovery.getGuardianConfig(account);
        address[] memory guardians = recovery.getAllGuardians(account);

        uint256 totalGuardians = guardians.length;
        uint256 toAccept = maxAccept > 0 ? maxAccept : totalGuardians;
        if (toAccept > totalGuardians) {
            toAccept = totalGuardians;
        }

        console2.log("=== MockAcceptGuardians (local only) ===");
        console2.log("chainId:", block.chainid);
        console2.log("Account:", account);
        console2.log("Harness (auto-read):", harnessAddr);
        console2.log("Total configured guardians:", totalGuardians);
        console2.log("Accepted weight:", config.acceptedWeight);
        console2.log("Threshold:", config.threshold);
        console2.log("Guardians to accept:", toAccept);

        bytes[] memory commandParams = new bytes[](1);
        commandParams[0] = abi.encode(account);

        vm.startBroadcast();
        for (uint256 i = 0; i < toAccept; i++) {
            console2.log("Accepting guardian", i, ":");
            console2.logAddress(guardians[i]);
            harness.exposedAcceptGuardian(guardians[i], templateIdx, commandParams);
        }
        vm.stopBroadcast();

        config = recovery.getGuardianConfig(account);
        console2.log("=== Acceptance Complete ===");
        console2.log("Accepted weight:", config.acceptedWeight);
        console2.log("Threshold:", config.threshold);
        if (config.acceptedWeight >= config.threshold) {
            console2.log("Threshold reached! Account can now initiate recovery.");
        } else {
            console2.log("Threshold NOT yet reached. Accept more guardians or increase weight.");
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
