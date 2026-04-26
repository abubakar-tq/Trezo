// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IMinimalProxyFactory} from "../interfaces/IMinimalProxyFactory.sol";
import {PasskeyTypes} from "../common/Types.sol";
import {ISmartAccount} from "../interfaces/IAccount.sol";
import {MinimalProxyFactory} from "../proxy/MinimalProxyFactory.sol";

contract AccountFactory {
    event AccountCreated(
        address indexed account,
        bytes32 indexed walletId,
        uint256 indexed walletIndex,
        bytes32 mode,
        bytes32 salt
    );

    error AccountFactory_ZeroAddress();

    bytes32 public constant PORTABLE_MODE = keccak256("TREZO_PORTABLE_MODE");
    bytes32 public constant CHAIN_SPECIFIC_MODE = keccak256("TREZO_CHAIN_SPECIFIC_MODE");
    bytes32 public constant PORTABLE_WALLET_SALT_TYPEHASH = keccak256("TREZO_WALLET_PORTABLE_V2");
    bytes32 public constant CHAIN_SPECIFIC_WALLET_SALT_TYPEHASH =
        keccak256("TREZO_WALLET_CHAIN_SPECIFIC_V2");

    address public immutable implementationTemplate;
    address public immutable deterministicRootDeployer;
    bytes32 public immutable proxyFactorySalt;
    address public immutable proxyFactory;
    address public immutable entryPoint;

    constructor(
        address _implementationTemplate,
        address _deterministicRootDeployer,
        bytes32 _proxyFactorySalt,
        address _entryPoint
    ) {
        if (_implementationTemplate == address(0) || _deterministicRootDeployer == address(0) || _entryPoint == address(0))
        {
            revert AccountFactory_ZeroAddress();
        }

        implementationTemplate = _implementationTemplate;
        deterministicRootDeployer = _deterministicRootDeployer;
        proxyFactorySalt = _proxyFactorySalt;
        entryPoint = _entryPoint;
        proxyFactory = _predictProxyFactory(_implementationTemplate, _deterministicRootDeployer, _proxyFactorySalt);
    }

    function createAccount(
        bytes32 walletId,
        uint256 walletIndex,
        address validator,
        PasskeyTypes.PasskeyInit calldata passkeyInit
    )
        external
        returns (address account)
    {
        account = _createAccount(PORTABLE_MODE, walletId, walletIndex, validator, passkeyInit);
    }

    function createChainSpecificAccount(
        bytes32 walletId,
        uint256 walletIndex,
        address validator,
        PasskeyTypes.PasskeyInit calldata passkeyInit
    )
        external
        returns (address account)
    {
        account = _createAccount(CHAIN_SPECIFIC_MODE, walletId, walletIndex, validator, passkeyInit);
    }

    function predictAccount(
        bytes32 walletId,
        uint256 walletIndex,
        address validator,
        PasskeyTypes.PasskeyInit calldata passkeyInit
    )
        external
        view
        returns (address predicted)
    {
        bytes32 initHash = initializerHash(validator, passkeyInit);
        return IMinimalProxyFactory(proxyFactory).predictProxyAddress(portableWalletSalt(walletId, walletIndex, initHash));
    }

    function predictChainSpecificAccount(
        bytes32 walletId,
        uint256 walletIndex,
        address validator,
        PasskeyTypes.PasskeyInit calldata passkeyInit
    )
        external
        view
        returns (address predicted)
    {
        bytes32 initHash = initializerHash(validator, passkeyInit);
        return
            IMinimalProxyFactory(proxyFactory).predictProxyAddress(
                chainSpecificWalletSalt(walletId, walletIndex, initHash)
            );
    }

    function portableWalletSalt(bytes32 walletId, uint256 walletIndex, bytes32 initHash) public pure returns (bytes32) {
        return keccak256(abi.encode(PORTABLE_WALLET_SALT_TYPEHASH, walletId, walletIndex, initHash));
    }

    function chainSpecificWalletSalt(bytes32 walletId, uint256 walletIndex, bytes32 initHash)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(CHAIN_SPECIFIC_WALLET_SALT_TYPEHASH, block.chainid, walletId, walletIndex, initHash));
    }

    function initializerCalldata(address validator, PasskeyTypes.PasskeyInit calldata passkeyInit)
        public
        view
        returns (bytes memory initCalldata)
    {
        initCalldata = abi.encodeWithSelector(ISmartAccount.initialize.selector, entryPoint, validator, passkeyInit);
    }

    function initializerHash(address validator, PasskeyTypes.PasskeyInit calldata passkeyInit)
        public
        view
        returns (bytes32)
    {
        return keccak256(initializerCalldata(validator, passkeyInit));
    }

    function predictProxyFactory(
        address _implementationTemplate,
        address _deterministicRootDeployer,
        bytes32 _proxyFactorySalt,
        address predictedAccountFactory
    )
        public
        pure
        returns (address predicted)
    {
        bytes memory initCode = abi.encodePacked(
            type(MinimalProxyFactory).creationCode,
            abi.encode(_implementationTemplate, predictedAccountFactory)
        );
        return Create2.computeAddress(_proxyFactorySalt, keccak256(initCode), _deterministicRootDeployer);
    }

    function _createAccount(
        bytes32 mode,
        bytes32 walletId,
        uint256 walletIndex,
        address validator,
        PasskeyTypes.PasskeyInit calldata passkeyInit
    )
        internal
        returns (address account)
    {
        bytes memory initCalldata = initializerCalldata(validator, passkeyInit);
        bytes32 initHash = keccak256(initCalldata);
        bytes32 salt = mode == PORTABLE_MODE
            ? portableWalletSalt(walletId, walletIndex, initHash)
            : chainSpecificWalletSalt(walletId, walletIndex, initHash);

        account = IMinimalProxyFactory(proxyFactory).createProxy(initCalldata, salt);
        emit AccountCreated(account, walletId, walletIndex, mode, salt);
    }

    function _predictProxyFactory(
        address _implementationTemplate,
        address _deterministicRootDeployer,
        bytes32 _proxyFactorySalt
    )
        internal
        view
        returns (address predicted)
    {
        return predictProxyFactory(
            _implementationTemplate,
            _deterministicRootDeployer,
            _proxyFactorySalt,
            address(this)
        );
    }
}
