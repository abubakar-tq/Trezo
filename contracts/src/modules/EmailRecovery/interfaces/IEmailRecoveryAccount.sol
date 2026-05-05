// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PasskeyTypes} from "src/common/Types.sol";

interface IEmailRecoveryAccount {

    /// @notice Add a new passkey via a trusted recovery module.
    function addPasskeyFromRecovery(PasskeyTypes.PasskeyInit calldata newPassKey) external;

    /// @notice Returns true when the given module is authorized as a recovery executor.
    function isRecoveryModule(address module) external view returns (bool);
}
