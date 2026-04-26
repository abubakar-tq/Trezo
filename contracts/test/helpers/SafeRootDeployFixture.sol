// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {DeployConstants} from "script/common/DeployConstants.sol";
import {DeployUtils} from "script/common/DeployUtils.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

contract MockSafeSingletonFactory {
    fallback() external payable {
        bytes32 salt;
        assembly {
            salt := calldataload(0)
        }

        bytes memory initCode = new bytes(msg.data.length - 32);
        for (uint256 i; i < initCode.length; ++i) {
            initCode[i] = msg.data[i + 32];
        }

        address deployed;
        assembly {
            deployed := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        require(deployed != address(0), "CREATE2_FAILED");
    }
}

abstract contract SafeRootDeployFixture is Test {
    function _installMockSafeSingletonFactory() internal {
        MockSafeSingletonFactory mock = new MockSafeSingletonFactory();
        vm.etch(DeployConstants.SAFE_SINGLETON_FACTORY, address(mock).code);
    }

    function _deployAccountStack()
        internal
        returns (
            HelperConfig helperConfig,
            SmartAccount smartAccount,
            MinimalProxyFactory proxyFactory,
            AccountFactory accountFactory,
            PasskeyValidator passkeyValidator,
            SocialRecovery socialRecovery
        )
    {
        _installMockSafeSingletonFactory();

        helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        address rootFactory = DeployConstants.SAFE_SINGLETON_FACTORY;

        address smartAccountImpl = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.SMART_ACCOUNT_IMPL_SALT,
            type(SmartAccount).creationCode
        );

        address predictedAccountFactory = DeployUtils.predict(
            rootFactory,
            DeployConstants.ACCOUNT_FACTORY_SALT,
            abi.encodePacked(
                type(AccountFactory).creationCode,
                abi.encode(
                    smartAccountImpl,
                    rootFactory,
                    DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
                    config.entryPoint
                )
            )
        );

        address proxyFactoryAddress = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
            abi.encodePacked(
                type(MinimalProxyFactory).creationCode,
                abi.encode(smartAccountImpl, predictedAccountFactory)
            )
        );

        address accountFactoryAddress = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.ACCOUNT_FACTORY_SALT,
            abi.encodePacked(
                type(AccountFactory).creationCode,
                abi.encode(
                    smartAccountImpl,
                    rootFactory,
                    DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
                    config.entryPoint
                )
            )
        );

        address passkeyValidatorAddress = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.PASSKEY_VALIDATOR_SALT,
            type(PasskeyValidator).creationCode
        );

        address socialRecoveryAddress = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.SOCIAL_RECOVERY_SALT,
            type(SocialRecovery).creationCode
        );

        require(accountFactoryAddress == predictedAccountFactory, "unexpected AccountFactory address");

        smartAccount = SmartAccount(payable(smartAccountImpl));
        proxyFactory = MinimalProxyFactory(proxyFactoryAddress);
        accountFactory = AccountFactory(accountFactoryAddress);
        passkeyValidator = PasskeyValidator(passkeyValidatorAddress);
        socialRecovery = SocialRecovery(socialRecoveryAddress);
    }
}
