// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {BeaconProxy} from "../../lib/openzeppelin-contracts/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title BeaconAwareProxy
 * @dev Standard proxy contract using OpenZeppelin's BeaconProxy implementation.
 *      This contract delegates all logic to the implementation provided by the beacon.
 */
contract BeaconAwareProxy is BeaconProxy {
    /**
     * @dev Initializes the proxy with the beacon and optional initialization calldata.
     *      This constructor is used for direct deployment (not clones).
     * @param beacon The address of the UpgradeableBeacon contract.
     * @param data Initialization calldata to delegatecall into the implementation (optional).
     */
    constructor(address beacon, bytes memory data) BeaconProxy(beacon, data) {}

    /**
     * @dev Post-deployment initializer for clones. Calls initialization logic on the implementation.
     *      Should be called once after deployment.
     * @param data Initialization calldata to delegatecall into the implementation
     */
    function init(bytes calldata data) external {
        // Initialization is handled in the implementation contract (e.g., SmartAccount.initialize)
        if (data.length > 0) {
            (bool ok, bytes memory ret) = _implementation().delegatecall(data);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
    }

    function getBeacon() external view returns (address) {
        return _getBeacon();
    }

    receive() external payable {}
}
