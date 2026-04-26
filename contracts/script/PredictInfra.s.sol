// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DeployConstants} from "./common/DeployConstants.sol";
import {DeployUtils} from "./common/DeployUtils.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

contract PredictInfra is Script {
    struct InfraAddresses {
        address smartAccountImpl;
        address accountFactory;
        address proxyFactory;
        address passkeyValidator;
        address socialRecovery;
    }

    function run() external view returns (InfraAddresses memory predicted) {
        predicted = predict();
        console2.log("=== PredictInfra ===");
        console2.log("chainId:", block.chainid);
        console2.log("release:", DeployConstants.TREZO_INFRA_VERSION);
        console2.log("rootFactory:", DeployConstants.SAFE_SINGLETON_FACTORY);
        console2.log("SmartAccount impl:", predicted.smartAccountImpl);
        console2.log("AccountFactory:", predicted.accountFactory);
        console2.log("MinimalProxyFactory:", predicted.proxyFactory);
        console2.log("PasskeyValidator:", predicted.passkeyValidator);
        console2.log("SocialRecovery:", predicted.socialRecovery);
    }

    function predict() public view returns (InfraAddresses memory predicted) {
        address entryPoint = vm.envOr("ENTRYPOINT", DeployConstants.ENTRYPOINT_V07);
        address rootFactory = DeployConstants.SAFE_SINGLETON_FACTORY;

        predicted.smartAccountImpl = DeployUtils.predict(
            rootFactory,
            DeployConstants.SMART_ACCOUNT_IMPL_SALT,
            type(SmartAccount).creationCode
        );

        predicted.accountFactory = DeployUtils.predict(
            rootFactory,
            DeployConstants.ACCOUNT_FACTORY_SALT,
            abi.encodePacked(
                type(AccountFactory).creationCode,
                abi.encode(
                    predicted.smartAccountImpl,
                    rootFactory,
                    DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
                    entryPoint
                )
            )
        );

        predicted.proxyFactory = DeployUtils.predict(
            rootFactory,
            DeployConstants.MINIMAL_PROXY_FACTORY_SALT,
            abi.encodePacked(
                type(MinimalProxyFactory).creationCode,
                abi.encode(predicted.smartAccountImpl, predicted.accountFactory)
            )
        );

        predicted.passkeyValidator = DeployUtils.predict(
            rootFactory,
            DeployConstants.PASSKEY_VALIDATOR_SALT,
            type(PasskeyValidator).creationCode
        );

        predicted.socialRecovery = DeployUtils.predict(
            rootFactory,
            DeployConstants.SOCIAL_RECOVERY_SALT,
            type(SocialRecovery).creationCode
        );
    }
}
