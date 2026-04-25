// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {CheckRootFactory} from "script/CheckRootFactory.s.sol";
import {CheckChainSupport} from "script/CheckChainSupport.s.sol";
import {DeployConstants} from "script/common/DeployConstants.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {DeployUtils} from "script/common/DeployUtils.sol";
import {DeployInfra} from "script/DeployInfra.s.sol";
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

contract DeployInfraHarness is DeployInfra {
    function writeArtifactsForTest(PredictInfra.InfraAddresses memory deployed, address entryPoint) external {
        _writeArtifacts(deployed, entryPoint);
    }

    function _releaseManifestPath() internal pure override returns (string memory) {
        return "deployments/releases/test-trezo-infra-v2.json";
    }

    function _chainManifestPath() internal view override returns (string memory) {
        return string.concat("deployments/chains/test-", vm.toString(block.chainid), ".json");
    }

    function _flatManifestPath() internal view override returns (string memory) {
        return string.concat("deployments/test-", vm.toString(block.chainid), ".json");
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

    function testDeployAccountRevertsOnNonLocalChain() public {
        vm.chainId(11_155_111);
        DeployAccount script = new DeployAccount();

        vm.expectRevert(abi.encodeWithSelector(DeployAccount.LegacyDeployAccountUnsupportedChain.selector, 11_155_111));
        script.deployAccount();
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

    function testDeployInfraWritesSafeSingletonFactoryToArtifacts() public {
        _installMockRootFactory();
        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();

        PredictInfra.InfraAddresses memory deployed;
        deployed.smartAccountImpl = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.SMART_ACCOUNT_IMPL_SALT,
            type(SmartAccount).creationCode
        );
        deployed.passkeyValidator = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.PASSKEY_VALIDATOR_SALT,
            type(PasskeyValidator).creationCode
        );
        deployed.socialRecovery = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.SOCIAL_RECOVERY_SALT,
            type(SocialRecovery).creationCode
        );
        deployed.proxyFactory = DeployUtils.deployThroughRootFactory(
            DeployConstants.SAFE_SINGLETON_FACTORY,
            DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
            abi.encodePacked(
                type(MinimalProxyFactory).creationCode,
                abi.encode(predicted.smartAccountImpl, predicted.accountFactory)
            )
        );
        deployed.accountFactory = DeployUtils.deployThroughRootFactory(
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

        DeployInfraHarness script = new DeployInfraHarness();
        script.writeArtifactsForTest(deployed, DeployConstants.ENTRYPOINT_V07);

        string memory releaseJson = vm.readFile("deployments/releases/test-trezo-infra-v2.json");
        string memory chainJson = vm.readFile("deployments/chains/test-31337.json");
        string memory flatJson = vm.readFile("deployments/test-31337.json");

        assertEq(vm.parseJsonAddress(releaseJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);
        assertEq(vm.parseJsonAddress(chainJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);
        assertEq(vm.parseJsonAddress(flatJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);

        vm.removeFile("deployments/releases/test-trezo-infra-v2.json");
        vm.removeFile("deployments/chains/test-31337.json");
        vm.removeFile("deployments/test-31337.json");
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
