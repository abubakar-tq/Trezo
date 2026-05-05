// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PredictInfra} from "./PredictInfra.s.sol";

contract VerifyInfra is Script {
    error MissingInfraCode(string name, address target);

    function run() external returns (bool ok) {
        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();

        _requireCode("SmartAccount", predicted.smartAccountImpl);
        _requireCode("AccountFactory", predicted.accountFactory);
        _requireCode("MinimalProxyFactory", predicted.proxyFactory);
        _requireCode("PasskeyValidator", predicted.passkeyValidator);
        _requireCode("SocialRecovery", predicted.socialRecovery);

        console2.log("=== VerifyInfra ===");
        console2.log("chainId:", block.chainid);
        console2.log("verified:", true);
        return true;
    }

    function _requireCode(string memory name, address target) internal view {
        if (target.code.length == 0) revert MissingInfraCode(name, target);
    }
}
