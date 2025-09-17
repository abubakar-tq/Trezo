// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";

contract DeployMinimal is Script {
    function run() external returns (HelperConfig helperConfig, SmartAccount smartAccount) {}

    // function deployMinimal() public returns (HelperConfig helperConfig, SmartAccount smartAccount) {
    //     helperConfig = new HelperConfig();

    //     HelperConfig.NetworkConfig memory networkConfig = helperConfig.getConfig();

    //     vm.startBroadcast(networkConfig.account);
    //     smartAccount = new SmartAccount(networkConfig.entryPoint);
    //     smartAccount.transferOwnership(networkConfig.account);
    //     vm.stopBroadcast();

    //     return (helperConfig, smartAccount);
    // }
}
