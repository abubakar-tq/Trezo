// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {PasskeyTypes} from "../modules/Types.sol";

interface ISmartAccount {
    function initialize(address entryPoint, address validator, PasskeyTypes.PasskeyInit calldata passkey) external;
}