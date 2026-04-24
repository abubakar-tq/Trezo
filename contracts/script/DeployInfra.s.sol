// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DeployConstants} from "./common/DeployConstants.sol";
import {DeployUtils} from "./common/DeployUtils.sol";
import {PredictInfra} from "./PredictInfra.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

contract DeployInfra is Script {
    function run() external returns (PredictInfra.InfraAddresses memory deployed) {
        address entryPoint = vm.envOr("ENTRYPOINT", DeployConstants.ENTRYPOINT_V07);
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address rootFactory = DeployConstants.SAFE_SINGLETON_FACTORY;

        PredictInfra predictor = new PredictInfra();
        PredictInfra.InfraAddresses memory predicted = predictor.predict();

        vm.startBroadcast(deployerKey);

        deployed.smartAccountImpl = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.SMART_ACCOUNT_IMPL_SALT,
            type(SmartAccount).creationCode
        );

        deployed.passkeyValidator = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.PASSKEY_VALIDATOR_SALT,
            type(PasskeyValidator).creationCode
        );

        deployed.socialRecovery = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.SOCIAL_RECOVERY_SALT,
            type(SocialRecovery).creationCode
        );

        deployed.proxyFactory = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
            abi.encodePacked(
                type(MinimalProxyFactory).creationCode,
                abi.encode(deployed.smartAccountImpl, predicted.accountFactory)
            )
        );

        deployed.accountFactory = DeployUtils.deployThroughRootFactory(
            rootFactory,
            DeployConstants.ACCOUNT_FACTORY_SALT,
            abi.encodePacked(
                type(AccountFactory).creationCode,
                abi.encode(
                    deployed.smartAccountImpl,
                    rootFactory,
                    DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
                    entryPoint
                )
            )
        );

        vm.stopBroadcast();

        require(deployed.smartAccountImpl == predicted.smartAccountImpl, "smart account prediction mismatch");
        require(deployed.accountFactory == predicted.accountFactory, "account factory prediction mismatch");
        require(deployed.proxyFactory == predicted.proxyFactory, "proxy factory prediction mismatch");
        require(deployed.passkeyValidator == predicted.passkeyValidator, "validator prediction mismatch");
        require(deployed.socialRecovery == predicted.socialRecovery, "social recovery prediction mismatch");

        _writeArtifacts(deployed, entryPoint);
        _log(deployed);
    }

    function _writeArtifacts(PredictInfra.InfraAddresses memory deployed, address entryPoint) internal {
        vm.createDir("deployments/releases", true);
        vm.createDir("deployments/chains", true);

        string memory releaseRoot = "release";
        vm.serializeString(releaseRoot, "release", DeployConstants.TREZO_INFRA_VERSION);
        vm.serializeAddress(releaseRoot, "rootFactory", DeployConstants.SAFE_SINGLETON_FACTORY);
        vm.serializeAddress(releaseRoot, "entryPoint", entryPoint);
        vm.serializeBytes32(releaseRoot, "smartAccountImplSalt", DeployConstants.SMART_ACCOUNT_IMPL_SALT);
        vm.serializeBytes32(releaseRoot, "accountFactorySalt", DeployConstants.ACCOUNT_FACTORY_SALT);
        vm.serializeBytes32(releaseRoot, "minimalProxyFactorySalt", DeployConstants.MINIMAL_PROXY_FACTORY_SALT);
        vm.serializeBytes32(releaseRoot, "passkeyValidatorSalt", DeployConstants.PASSKEY_VALIDATOR_SALT);
        string memory releaseJson =
            vm.serializeBytes32(releaseRoot, "socialRecoverySalt", DeployConstants.SOCIAL_RECOVERY_SALT);
        vm.writeJson(releaseJson, "deployments/releases/trezo-infra-v2.json");

        string memory chainRoot = "chain";
        vm.serializeUint(chainRoot, "chainId", block.chainid);
        vm.serializeString(chainRoot, "infraVersion", DeployConstants.TREZO_INFRA_VERSION);
        vm.serializeAddress(chainRoot, "rootFactory", DeployConstants.SAFE_SINGLETON_FACTORY);
        vm.serializeAddress(chainRoot, "entryPoint", entryPoint);
        vm.serializeBool(chainRoot, "portable", DeployConstants.isPortableChain(block.chainid));
        vm.serializeAddress(chainRoot, "smartAccountImpl", deployed.smartAccountImpl);
        vm.serializeAddress(chainRoot, "proxyFactory", deployed.proxyFactory);
        vm.serializeAddress(chainRoot, "accountFactory", deployed.accountFactory);
        vm.serializeAddress(chainRoot, "passkeyValidator", deployed.passkeyValidator);
        string memory chainJson = vm.serializeAddress(chainRoot, "socialRecovery", deployed.socialRecovery);
        vm.writeJson(chainJson, string.concat("deployments/chains/", vm.toString(block.chainid), ".json"));

        vm.writeJson(chainJson, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }

    function _log(PredictInfra.InfraAddresses memory deployed) internal view {
        console2.log("=== DeployInfra ===");
        console2.log("chainId:", block.chainid);
        console2.log("SmartAccount impl:", deployed.smartAccountImpl);
        console2.log("AccountFactory:", deployed.accountFactory);
        console2.log("MinimalProxyFactory:", deployed.proxyFactory);
        console2.log("PasskeyValidator:", deployed.passkeyValidator);
        console2.log("SocialRecovery:", deployed.socialRecovery);
    }
}
