// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

library DeployUtils {
    error RootFactoryMissing(address rootFactory);
    error DeterministicDeployFailed(address rootFactory, bytes32 salt, address predicted);

    function predict(address rootFactory, bytes32 salt, bytes memory initCode) internal pure returns (address) {
        return Create2.computeAddress(salt, keccak256(initCode), rootFactory);
    }

    function deployThroughRootFactory(address rootFactory, bytes32 salt, bytes memory initCode)
        internal
        returns (address predicted)
    {
        predicted = predict(rootFactory, salt, initCode);
        if (predicted.code.length != 0) return predicted;
        if (rootFactory.code.length == 0) revert RootFactoryMissing(rootFactory);

        (bool ok,) = rootFactory.call(bytes.concat(salt, initCode));
        if (!ok || predicted.code.length == 0) {
            revert DeterministicDeployFailed(rootFactory, salt, predicted);
        }
    }
}
