// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DeployInfra} from "./DeployInfra.s.sol";
import {PredictInfra} from "./PredictInfra.s.sol";

contract DeployInfraLocalPortable is DeployInfra {
    function _writeArtifacts(PredictInfra.InfraAddresses memory deployed, address entryPoint) internal override {
        vm.createDir("deployments/local/releases", true);
        vm.createDir("deployments/local/chains", true);
        super._writeArtifacts(deployed, entryPoint);
    }

    function _releaseManifestPath() internal pure override returns (string memory) {
        return "deployments/local/releases/trezo-infra-v2.json";
    }

    function _chainManifestPath() internal view override returns (string memory) {
        return string.concat("deployments/local/chains/", vm.toString(block.chainid), ".json");
    }
}
