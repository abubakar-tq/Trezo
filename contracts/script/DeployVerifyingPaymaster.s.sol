// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {VerifyingPaymaster} from "lib/modulekit/node_modules/account-abstraction/contracts/samples/VerifyingPaymaster.sol";
import {IEntryPoint} from "lib/modulekit/node_modules/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {DeployConstants} from "./common/DeployConstants.sol";

/**
 * Deploys a VerifyingPaymaster and optionally deposits ETH into the EntryPoint.
 *
 * Required env vars:
 *   PAYMASTER_SIGNER   — EOA whose private key the pm-rpc edge function holds
 *
 * Optional env vars:
 *   ENTRYPOINT              — defaults to EntryPoint v0.7
 *   PAYMASTER_DEPOSIT_WEI   — amount to deposit on deploy (e.g. 5000000000000000 = 0.005 ETH)
 *
 * Usage:
 *   make deploy-verifying-paymaster BASE_MAINNET_RPC_URL=... PAYMASTER_SIGNER=0x...
 */
contract DeployVerifyingPaymaster is Script {
    function run() external returns (address paymaster) {
        address entryPoint = vm.envOr("ENTRYPOINT", DeployConstants.ENTRYPOINT_V07);
        address signer = vm.envAddress("PAYMASTER_SIGNER");
        uint256 depositWei = vm.envOr("PAYMASTER_DEPOSIT_WEI", uint256(0));

        vm.startBroadcast();

        VerifyingPaymaster pm = new VerifyingPaymaster(IEntryPoint(entryPoint), signer);

        if (depositWei > 0) {
            pm.deposit{value: depositWei}();
        }

        vm.stopBroadcast();

        paymaster = address(pm);

        console2.log("=== DeployVerifyingPaymaster ===");
        console2.log("chainId:      ", block.chainid);
        console2.log("paymaster:    ", paymaster);
        console2.log("entryPoint:   ", entryPoint);
        console2.log("signer:       ", signer);
        console2.log("depositWei:   ", depositWei);
        console2.log("Set env var:  EXPO_PUBLIC_BASE_MAINNET_PAYMASTER_URL=<supabase-pm-rpc-url>");
        console2.log("Set secret:   PAYMASTER_ADDRESS=", paymaster);

        vm.createDir("deployments", true);
        string memory root = "pm";
        vm.serializeAddress(root, "address", paymaster);
        vm.serializeAddress(root, "entryPoint", entryPoint);
        vm.serializeAddress(root, "signer", signer);
        vm.serializeUint(root, "depositWei", depositWei);
        string memory json = vm.serializeUint(root, "chainId", block.chainid);
        vm.writeJson(json, string.concat("deployments/verifying-paymaster-", vm.toString(block.chainid), ".json"));
    }
}
