// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title MinimalProxyFactory
 * @dev Deploys minimal proxies (EIP-1167 clones)
 *      Uses OpenZeppelin's Clones library for deterministic deployments via CREATE2.
 */
contract MinimalProxyFactory {
    event ProxyDeployed(address indexed proxy, bytes32 salt);

    error MinimalProxyFactory_OnlyAccountFactory(address caller, address accountFactory);
    error MinimalProxyFactory_ZeroAddress();

    // Address of the implementation template
    address public immutable implementationTemplate;
    address public immutable accountFactory;

    /**
     * @dev Sets the implementation template to be cloned.
     * @param _template Address of the deployed SmartAccount implementation.
     * @param _accountFactory AccountFactory allowed to deploy and initialize clones.
     */
    constructor(address _template, address _accountFactory) {
        if (_template == address(0) || _accountFactory == address(0)) {
            revert MinimalProxyFactory_ZeroAddress();
        }
        implementationTemplate = _template;
        accountFactory = _accountFactory;
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
        if (msg.sender != accountFactory) {
            revert MinimalProxyFactory_OnlyAccountFactory(msg.sender, accountFactory);
        }

        // Deploys the minimal proxy at a deterministic address using CREATE2
        proxy = Clones.cloneDeterministic(implementationTemplate, salt);
        emit ProxyDeployed(proxy, salt);

        // Initializes the proxy
        (bool ok, bytes memory ret) =
            proxy.call(initCalldata);
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
