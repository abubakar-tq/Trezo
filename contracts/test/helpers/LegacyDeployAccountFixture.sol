// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {SocialRecovery} from "src/modules/SocialRecovery/SocialRecovery.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";

abstract contract LegacyDeployAccountFixture {
    function _deployLegacyAccountStack()
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
        DeployAccount deployScript = new DeployAccount();
        return deployScript.deployAccount();
    }
}
