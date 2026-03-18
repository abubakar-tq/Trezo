// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/common/Types.sol";
import {IModule} from "lib/modulekit/src/accounts/common/interfaces/IERC7579Module.sol";

interface IEmailRecovery is IModule {
    /**
     * @notice Convenience helper to build the keccak hash guardians must vote on.
     * @dev recoveryData should be abi.encode(newPasskey). The resulting hash is the value
     *      that must appear in the recovery email so it can be matched during execution.
     */
    function recoveryDataHash(PasskeyTypes.PasskeyInit calldata newPasskey)
        external
        pure
        returns (bytes32);

    /**
     * @notice Returns true when enough guardians have accepted to start a recovery flow.
     */
    function canStartRecoveryRequest(address account) external view returns (bool);
}
