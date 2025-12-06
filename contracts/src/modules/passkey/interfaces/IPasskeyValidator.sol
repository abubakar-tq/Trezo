// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IPasskeyValidator {
    function addPasskey(bytes32 idRaw, uint256 px, uint256 py, bytes32 rpIdHash) external;
}
