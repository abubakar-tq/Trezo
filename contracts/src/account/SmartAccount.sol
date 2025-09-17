// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SmartAccount {
    address public owner;
    bool private _initialized;

    event OwnerSet(address indexed owner);

    error AlreadyInitialized();
    error NotOwner();

    function initialize(address _owner) external {
        if (_initialized) revert AlreadyInitialized();
        owner = _owner;
        _initialized = true;
        emit OwnerSet(_owner);
    }

    // a no-op example function just to prove delegatecall works
    function ping() external view returns (bytes32 who, address _owner) {
        return (blockhash(block.number - 1), owner);
    }
}
