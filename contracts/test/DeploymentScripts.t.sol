// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CheckRootFactory} from "script/CheckRootFactory.s.sol";
import {CheckChainSupport} from "script/CheckChainSupport.s.sol";
import {DeployConstants} from "script/common/DeployConstants.sol";
import {DeployUtils} from "script/common/DeployUtils.sol";
import {PredictInfra} from "script/PredictInfra.s.sol";
import {VerifyInfra} from "script/VerifyInfra.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

contract MockRawCreate2Factory {
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

contract DeploymentScriptsTest is Test {
    function testCheckRootFactoryFailsWhenMissing() public {
        vm.etch(DeployConstants.SAFE_SINGLETON_FACTORY, "");
        CheckRootFactory script = new CheckRootFactory();

        vm.expectRevert();
        script.run();
    }

    function testCheckRootFactoryPassesWhenPresent() public {
        _installMockRootFactory();
        CheckRootFactory script = new CheckRootFactory();

        assertTrue(script.run(), "root factory should exist");
    }

    function testCheckChainSupportMarksPortableChain() public {
        _installMockRootFactory();
        vm.chainId(1);
        CheckChainSupport script = new CheckChainSupport();

        assertEq(uint256(script.run()), uint256(CheckChainSupport.ChainMode.Portable));
    }

    function testCheckChainSupportMarksZkSyncNonPortable() public {
        _installMockRootFactory();
        vm.chainId(324);
        CheckChainSupport script = new CheckChainSupport();

        assertEq(uint256(script.run()), uint256(CheckChainSupport.ChainMode.ChainSpecific));
    }

    function testPredictAndDeployInfraAgree() public {
        _installMockRootFactory();
        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();

        address smartAccountImpl = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.SMART_ACCOUNT_IMPL_SALT,
            type(SmartAccount).creationCode
        );
        address passkeyValidator = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.PASSKEY_VALIDATOR_SALT,
            type(PasskeyValidator).creationCode
        );
        address socialRecovery = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.SOCIAL_RECOVERY_SALT,
            type(SocialRecovery).creationCode
        );
        address proxyFactory = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
            abi.encodePacked(
                type(MinimalProxyFactory).creationCode,
                abi.encode(predicted.smartAccountImpl, predicted.accountFactory)
            )
        );
        address accountFactory = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.ACCOUNT_FACTORY_SALT,
            abi.encodePacked(
                type(AccountFactory).creationCode,
                abi.encode(
                    predicted.smartAccountImpl,
                    DeployConstants.SAFE_SINGLETON_FACTORY,
                    DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
                    DeployConstants.ENTRYPOINT_V07
                )
            )
        );

        assertEq(smartAccountImpl, predicted.smartAccountImpl);
        assertEq(passkeyValidator, predicted.passkeyValidator);
        assertEq(socialRecovery, predicted.socialRecovery);
        assertEq(proxyFactory, predicted.proxyFactory);
        assertEq(accountFactory, predicted.accountFactory);
    }

    function testVerifyInfraFailsWhenMissingCode() public {
        _installMockRootFactory();
        VerifyInfra script = new VerifyInfra();

        vm.expectRevert();
        script.run();
    }

    function _installMockRootFactory() internal {
        MockRawCreate2Factory mock = new MockRawCreate2Factory();
        vm.etch(DeployConstants.SAFE_SINGLETON_FACTORY, address(mock).code);
    }
}
