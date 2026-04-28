// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {DeployConstants} from "script/common/DeployConstants.sol";
import {DeployEmailRecovery} from "script/DeployEmailRecovery.s.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";

contract DeployEmailRecoveryHarness is DeployEmailRecovery {
    function deployForTest() external returns (DeploymentResult memory result) {
        Config memory config = _loadConfig();
        _applyDefaults(config);
        _validateConfig(config);
        return _deploy(config);
    }

    function deployAndWriteForTest() external returns (DeploymentResult memory result) {
        Config memory config = _loadConfig();
        _applyDefaults(config);
        _validateConfig(config);
        result = _deploy(config);
        _writeDeploymentJson(config, result);
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

    function testDeployEmailRecoveryPreservesCoreRootMetadata() public {
        string memory root = "root";
        string memory path = "deployments/31337.json";

        vm.serializeUint(root, "chainId", 31_337);
        vm.serializeString(root, "infraVersion", DeployConstants.TREZO_INFRA_VERSION);
        vm.serializeAddress(root, "rootFactory", DeployConstants.SAFE_SINGLETON_FACTORY);
        vm.serializeBool(root, "portable", false);
        vm.serializeAddress(root, "entryPoint", DeployConstants.ENTRYPOINT_V07);
        vm.serializeAddress(root, "smartAccountImpl", address(0x1001));
        vm.serializeAddress(root, "proxyFactory", address(0x1002));
        vm.serializeAddress(root, "accountFactory", address(0x1003));
        vm.serializeAddress(root, "passkeyValidator", address(0x1004));
        vm.serializeAddress(root, "socialRecovery", address(0x1005));
        string memory json = vm.serializeBool(root, "success", true);
        vm.writeJson(json, path);

        DeployEmailRecoveryHarness script = new DeployEmailRecoveryHarness();
        script.deployAndWriteForTest();

        string memory updatedJson = vm.readFile(path);
        assertEq(vm.parseJsonAddress(updatedJson, ".rootFactory"), DeployConstants.SAFE_SINGLETON_FACTORY);
        assertEq(
            keccak256(bytes(vm.parseJsonString(updatedJson, ".infraVersion"))),
            keccak256(bytes(DeployConstants.TREZO_INFRA_VERSION))
        );
        assertFalse(vm.parseJsonBool(updatedJson, ".portable"));
        assertEq(vm.parseJsonAddress(updatedJson, ".accountFactory"), address(0x1003));
        assertTrue(vm.parseJsonAddress(updatedJson, ".emailRecovery") != address(0), "emailRecovery");
    }
}
