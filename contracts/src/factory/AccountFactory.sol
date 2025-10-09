// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {HelperConfig} from "script/HelperConfig.s.sol";
import {IMinimalProxyFactory} from "../interfaces/IMinimalProxyFactory.sol";
import {PasskeyTypes} from "../common/Types.sol";
import {ISmartAccount} from "../interfaces/IAccount.sol";




contract AccountFactory {
    event AccountCreated(address indexed account,bytes32 salt);

    address public immutable proxyFactory; // MinimalProxyFactory
    address public immutable entryPoint; // IEntryPoint

    constructor( address _proxyFactory, address _entryPoint) {

        proxyFactory = _proxyFactory;
        entryPoint = _entryPoint;
        
    }

    /// @notice CREATE2-deploy a new wallet proxy 
    function createAccount(bytes32 salt,address validator,PasskeyTypes.PasskeyInit calldata passkeyInit) external returns (address account) {
        // init calldata = SmartAccount.initialize( entryPoint)
        bytes memory initCalldata = abi.encodeWithSelector(ISmartAccount.initialize.selector, entryPoint,validator,passkeyInit);


        account = IMinimalProxyFactory(proxyFactory).createProxy(initCalldata, salt);
        emit AccountCreated(account, salt);
    }

    function predictAccount(bytes32 salt) external view returns (address predicted) {
        return IMinimalProxyFactory(proxyFactory).predictProxyAddress(salt);
    }
}
