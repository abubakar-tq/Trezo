// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {DeployEmailRecovery} from "script/DeployEmailRecovery.s.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";

contract DeployEmailRecoveryHarness is DeployEmailRecovery {
    function deployForTest() external returns (DeploymentResult memory result) {
        Config memory config = _loadConfig();
        _applyDefaults(config);
        _validateConfig(config);
        return _deploy(config);
    }
}

contract DeployEmailRecoveryScriptSmokeTest is Test {
    function testDeployEmailRecoveryScriptSmoke() public {
        DeployEmailRecoveryHarness script = new DeployEmailRecoveryHarness();
        DeployEmailRecovery.DeploymentResult memory result = script.deployForTest();

        assertTrue(result.emailRecovery != address(0), "emailRecovery");
        assertTrue(result.zkEmailVerifier != address(0), "verifier");
        assertTrue(result.zkEmailDkimRegistry != address(0), "dkimRegistry");
        assertTrue(result.zkEmailAuthImpl != address(0), "emailAuthImpl");
        assertTrue(result.emailRecoveryCommandHandler != address(0), "commandHandler");

        EmailRecovery module = EmailRecovery(result.emailRecovery);
        assertEq(module.verifier(), result.zkEmailVerifier, "verifier wiring");
        assertEq(module.dkim(), result.zkEmailDkimRegistry, "dkim wiring");
        assertEq(module.emailAuthImplementation(), result.zkEmailAuthImpl, "email auth wiring");
        assertEq(module.commandHandler(), result.emailRecoveryCommandHandler, "handler wiring");
    }
}
