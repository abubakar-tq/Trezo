// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

/**
 * @title AccountBeacon
 * @dev This contract is a thin wrapper around OpenZeppelin's UpgradeableBeacon.
 *      It provides a beacon for upgradeable proxies, delegating all logic to OpenZeppelin's implementation.
 *      Use this contract if you want a named beacon in your codebase for clarity.
 */
contract AccountBeacon is UpgradeableBeacon {
    /**
     * @dev Initializes the beacon with the initial implementation contract.
     *      Ownership is set to the deployer by default (OpenZeppelin's Ownable).
     * @param implementation_ The address of the initial implementation contract.
     */
    constructor(address implementation_) UpgradeableBeacon(implementation_,msg.sender) {}
}
