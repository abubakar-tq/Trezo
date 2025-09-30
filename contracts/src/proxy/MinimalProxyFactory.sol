// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

// Interface for the minimal beacon proxy, requiring an init function
interface IBeaconProxyMinimal {
    function init(bytes calldata initCalldata) external;
}

/**
 * @title MinimalProxyFactory
 * @dev Deploys minimal proxies (EIP-1167 clones) pointing to a beacon-aware implementation.
 *      Uses OpenZeppelin's Clones library for deterministic deployments via CREATE2.
 */
contract MinimalProxyFactory {
    event ProxyDeployed(address indexed proxy, bytes32 salt);

    error InitFailed();

    // Address of the implementation template (BeaconProxyMinimal contract)
    address public immutable implementationTemplate;

    /**
     * @dev Sets the implementation template to be cloned.
     * @param _template Address of the deployed BeaconProxyMinimal contract.
     */
    constructor(address _template) {
        implementationTemplate = _template;
    }

    /**
     * @notice Deploys a minimal proxy using CREATE2 and initializes it.
     * @param initCalldata Initialization data for the proxy (e.g., entryPoint, modules).
     * @param salt Unique value to ensure deterministic address.
     * @return proxy Address of the deployed proxy.
     *
     * How it works:
     * - Uses Clones.cloneDeterministic to deploy a minimal proxy at a predictable address.
     * - Calls the proxy's init function to set up its state.
     */
    function createProxy(bytes calldata initCalldata, bytes32 salt) external returns (address proxy) {
        // Deploys the minimal proxy at a deterministic address using CREATE2
        proxy = Clones.cloneDeterministic(implementationTemplate, salt);
        emit ProxyDeployed(proxy, salt);

        // Initializes the proxy
        (bool ok, bytes memory ret) =
            proxy.call(abi.encodeWithSelector(IBeaconProxyMinimal.init.selector, initCalldata));
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    /**
     * @notice Predicts the deterministic address for a proxy deployed with given salt.
     * @param salt Unique value used for CREATE2 deployment.
     * @return predicted The address where the proxy will be deployed.
     */
    function predictProxyAddress(bytes32 salt) external view returns (address predicted) {
        predicted = Clones.predictDeterministicAddress(implementationTemplate, salt, address(this));
    }
}
