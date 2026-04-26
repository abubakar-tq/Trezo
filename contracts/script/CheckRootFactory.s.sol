// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DeployConstants} from "./common/DeployConstants.sol";

contract CheckRootFactory is Script {
    error RootFactoryMissing(address rootFactory, uint256 chainId);

    function run() external view returns (bool exists) {
        exists = DeployConstants.SAFE_SINGLETON_FACTORY.code.length != 0;
        console2.log("chainId:", block.chainid);
        console2.log("Safe Singleton Factory:", DeployConstants.SAFE_SINGLETON_FACTORY);
        console2.log("exists:", exists);
        if (!exists) revert RootFactoryMissing(DeployConstants.SAFE_SINGLETON_FACTORY, block.chainid);
    }
}
