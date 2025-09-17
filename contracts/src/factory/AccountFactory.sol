// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IMinimalProxyFactory {
    function createProxy( bytes calldata initCalldata, bytes32 salt) external returns (address proxy);
    function predictProxyAddress(bytes32 salt) external view returns (address predicted);
}

contract AccountFactory {
    event AccountCreated(address indexed account, address indexed owner, bytes32 salt);

    address public immutable beacon;      // AccountBeacon
    address public immutable proxyFactory; // MinimalProxyFactory

    constructor(address _beacon, address _proxyFactory) {
        beacon = _beacon;
        proxyFactory = _proxyFactory;
    }

    /// @notice CREATE2-deploy a new wallet proxy and initialize owner
    function createAccount(address owner, bytes32 salt) external returns (address account) {
        // init calldata = DummyAccount.initialize(owner)
        bytes memory initCalldata = abi.encodeWithSignature("initialize(address)", owner);
        account = IMinimalProxyFactory(proxyFactory).createProxy(initCalldata, salt);
        emit AccountCreated(account, owner, salt);
    }

    function predictAccount(bytes32 salt) external view returns (address predicted) {
        return IMinimalProxyFactory(proxyFactory).predictProxyAddress(salt);
    }
}
