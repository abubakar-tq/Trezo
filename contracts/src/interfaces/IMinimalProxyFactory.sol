// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IMinimalProxyFactory {
    function createProxy(bytes calldata initCalldata, bytes32 salt) external returns (address proxy);
    function predictProxyAddress(bytes32 salt) external view returns (address predicted);
}
