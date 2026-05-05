// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DeployConstants} from "./common/DeployConstants.sol";
import {PredictInfra} from "./PredictInfra.s.sol";

contract CheckChainSupport is Script {
    enum ChainMode {
        Unsupported,
        Portable,
        ChainSpecific
    }

    function run() external returns (ChainMode mode) {
        bool rootFactoryExists = DeployConstants.SAFE_SINGLETON_FACTORY.code.length != 0;
        bool portable = DeployConstants.isPortableChain(block.chainid) && rootFactoryExists;
        bool nonPortable = DeployConstants.isNonPortableChain(block.chainid);

        if (portable) {
            mode = ChainMode.Portable;
        } else if (nonPortable) {
            mode = ChainMode.ChainSpecific;
        } else {
            mode = ChainMode.Unsupported;
        }

        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();

        console2.log("=== CheckChainSupport ===");
        console2.log("chainId:", block.chainid);
        console2.log("rootFactoryExists:", rootFactoryExists);
        console2.log("portableAllowlisted:", DeployConstants.isPortableChain(block.chainid));
        console2.log("nonPortableKnown:", nonPortable);
        console2.log("infraSmartAccountExists:", predicted.smartAccountImpl.code.length != 0);
        console2.log("infraAccountFactoryExists:", predicted.accountFactory.code.length != 0);
        console2.log("mode:", uint256(mode));
    }
}
