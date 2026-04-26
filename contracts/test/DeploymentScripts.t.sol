// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {CheckRootFactory} from "script/CheckRootFactory.s.sol";
import {CheckChainSupport} from "script/CheckChainSupport.s.sol";
import {DeployConstants} from "script/common/DeployConstants.sol";
import {DeployUtils} from "script/common/DeployUtils.sol";
import {DeployInfra} from "script/DeployInfra.s.sol";
import {PredictInfra} from "script/PredictInfra.s.sol";
import {VerifyInfra} from "script/VerifyInfra.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {SafeRootDeployFixture} from "test/helpers/SafeRootDeployFixture.sol";

contract DeployInfraReleaseHarness is DeployInfra {
    function writeArtifactsForTest(PredictInfra.InfraAddresses memory deployed, address entryPoint) external {
        _writeArtifacts(deployed, entryPoint);
    }

    function _artifactRootPath() internal pure override returns (string memory) {
        return "deployments/test-release";
    }

    function _flatManifestPath() internal view override returns (string memory) {
        return string.concat(_artifactRootPath(), "/flat-", vm.toString(block.chainid), ".json");
    }
}

contract DeployInfraLocalNamespaceHarness is DeployInfra {
    function writeArtifactsForTest(PredictInfra.InfraAddresses memory deployed, address entryPoint) external {
        _writeArtifacts(deployed, entryPoint);
    }

    function _flatManifestPath() internal view override returns (string memory) {
        return string.concat(_artifactRootPath(), "/flat-", vm.toString(block.chainid), ".json");
    }
}

contract DeploymentScriptsTest is SafeRootDeployFixture {
    function testCheckRootFactoryFailsWhenMissing() public {
        vm.etch(DeployConstants.SAFE_SINGLETON_FACTORY, "");
        CheckRootFactory script = new CheckRootFactory();

        vm.expectRevert();
        script.run();
    }

    function testCheckRootFactoryPassesWhenPresent() public {
        _installMockSafeSingletonFactory();
        CheckRootFactory script = new CheckRootFactory();

        assertTrue(script.run(), "root factory should exist");
    }

    function testCheckChainSupportMarksPortableChain() public {
        _installMockSafeSingletonFactory();
        vm.chainId(1);
        CheckChainSupport script = new CheckChainSupport();

        assertEq(uint256(script.run()), uint256(CheckChainSupport.ChainMode.Portable));
    }

    function testCheckChainSupportMarksZkSyncNonPortable() public {
        _installMockSafeSingletonFactory();
        vm.chainId(324);
        CheckChainSupport script = new CheckChainSupport();

        assertEq(uint256(script.run()), uint256(CheckChainSupport.ChainMode.ChainSpecific));
    }

    function testPredictAndDeployInfraAgree() public {
        _installMockSafeSingletonFactory();
        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();

        PredictInfra.InfraAddresses memory deployed = _deployInfra(predicted, DeployConstants.ENTRYPOINT_V07);

        assertEq(deployed.smartAccountImpl, predicted.smartAccountImpl);
        assertEq(deployed.passkeyValidator, predicted.passkeyValidator);
        assertEq(deployed.socialRecovery, predicted.socialRecovery);
        assertEq(deployed.proxyFactory, predicted.proxyFactory);
        assertEq(deployed.accountFactory, predicted.accountFactory);
    }

    function testDeployInfraWritesCanonicalArtifactsToReleaseNamespace() public {
        _installMockSafeSingletonFactory();
        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();
        PredictInfra.InfraAddresses memory deployed = _deployInfra(predicted, DeployConstants.ENTRYPOINT_V07);

        DeployInfraReleaseHarness script = new DeployInfraReleaseHarness();
        script.writeArtifactsForTest(deployed, DeployConstants.ENTRYPOINT_V07);

        string memory releaseJson = vm.readFile("deployments/test-release/releases/trezo-infra-v2.json");
        string memory chainJson = vm.readFile("deployments/test-release/chains/31337.json");
        string memory flatJson = vm.readFile("deployments/test-release/flat-31337.json");

        assertEq(vm.parseJsonAddress(releaseJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);
        assertEq(vm.parseJsonAddress(chainJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);
        assertEq(vm.parseJsonAddress(flatJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);

        vm.removeFile("deployments/test-release/releases/trezo-infra-v2.json");
        vm.removeFile("deployments/test-release/chains/31337.json");
        vm.removeFile("deployments/test-release/flat-31337.json");
    }

    function testDeployInfraWritesNamespacedArtifactsWhenNamespaceIsSet() public {
        _installMockSafeSingletonFactory();
        vm.setEnv("DEPLOYMENT_NAMESPACE", "test-local");

        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();
        PredictInfra.InfraAddresses memory deployed = _deployInfra(predicted, DeployConstants.ENTRYPOINT_V07);

        DeployInfraLocalNamespaceHarness script = new DeployInfraLocalNamespaceHarness();
        script.writeArtifactsForTest(deployed, DeployConstants.ENTRYPOINT_V07);

        string memory releaseJson = vm.readFile("deployments/test-local/releases/trezo-infra-v2.json");
        string memory chainJson = vm.readFile("deployments/test-local/chains/31337.json");
        string memory flatJson = vm.readFile("deployments/test-local/flat-31337.json");

        assertEq(vm.parseJsonAddress(releaseJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);
        assertEq(vm.parseJsonAddress(chainJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);
        assertEq(vm.parseJsonAddress(flatJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);

        vm.removeFile("deployments/test-local/releases/trezo-infra-v2.json");
        vm.removeFile("deployments/test-local/chains/31337.json");
        vm.removeFile("deployments/test-local/flat-31337.json");
    }

    function testVerifyInfraFailsWhenMissingCode() public {
        _installMockSafeSingletonFactory();
        VerifyInfra script = new VerifyInfra();

        vm.expectRevert();
        script.run();
    }

    function _deployInfra(PredictInfra.InfraAddresses memory predicted, address entryPoint)
        internal
        returns (PredictInfra.InfraAddresses memory deployed)
    {
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
                    entryPoint
                )
            )
        );
    }
}
