// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {EmailAuth} from "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";
import {Groth16Verifier} from "@zk-email/ether-email-auth-contracts/src/utils/Groth16Verifier.sol";
import {Verifier} from "@zk-email/ether-email-auth-contracts/src/utils/Verifier.sol";
import {UserOverrideableDKIMRegistry} from "@zk-email/contracts/UserOverrideableDKIMRegistry.sol";
import {EmailRecoveryCommandHandler} from "email-recovery/handlers/EmailRecoveryCommandHandler.sol";
import {EmailRecoveryHarness} from "test/harness/EmailRecoveryHarness.sol";

/**
 * @title DeployMockEmailRecovery
 * @notice LOCAL-ONLY deployment script for the EmailRecoveryHarness on Anvil.
 *         Hard-reverts on any chain that is not 31337, 31338, or 31339.
 *         Must NEVER be used for testnet or production deployments.
 *
 *         Production deploys should use DeployEmailRecovery.s.sol which deploys
 *         the real EmailRecovery module only.
 */
contract DeployMockEmailRecovery is Script {
    error NotLocalChain(uint256 chainId);

    uint256 internal constant LOCAL_CHAIN_1 = 31_337;
    uint256 internal constant LOCAL_CHAIN_2 = 31_338;
    uint256 internal constant LOCAL_CHAIN_3 = 31_339;
    address internal constant ANVIL_DEFAULT_ACCOUNT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    struct HarnessDeploymentResult {
        address emailRecoveryHarness;
        address emailRecoveryCommandHandler;
        address zkEmailVerifier;
        address zkEmailDkimRegistry;
        address zkEmailAuthImpl;
    }

    modifier onlyLocal() {
        if (block.chainid != LOCAL_CHAIN_1 && block.chainid != LOCAL_CHAIN_2 && block.chainid != LOCAL_CHAIN_3) {
            revert NotLocalChain(block.chainid);
        }
        _;
    }

    function run() external onlyLocal returns (HarnessDeploymentResult memory result) {
        address killSwitchAuthorizer = vm.envOr("KILL_SWITCH_AUTHORIZER", ANVIL_DEFAULT_ACCOUNT);
        address dkimSigner = vm.envOr("DKIM_SIGNER", ANVIL_DEFAULT_ACCOUNT);
        uint256 minimumDelay = vm.envOr("MINIMUM_DELAY", uint256(0));
        uint256 dkimDelay = vm.envOr("DKIM_DELAY", uint256(0));
        bytes32 create2Salt = bytes32(vm.envOr("CREATE2_SALT", uint256(0)));

        vm.startBroadcast();

        UserOverrideableDKIMRegistry dkimImpl = new UserOverrideableDKIMRegistry{salt: create2Salt}();
        address dkimProxy = address(
            new ERC1967Proxy{salt: create2Salt}(
                address(dkimImpl),
                abi.encodeCall(dkimImpl.initialize, (killSwitchAuthorizer, dkimSigner, dkimDelay))
            )
        );
        result.zkEmailDkimRegistry = dkimProxy;

        result.zkEmailAuthImpl = address(new EmailAuth{salt: create2Salt}());

        Verifier verifierImpl = new Verifier{salt: create2Salt}();
        Groth16Verifier groth16Verifier = new Groth16Verifier{salt: create2Salt}();
        address verifierProxy = address(
            new ERC1967Proxy{salt: create2Salt}(
                address(verifierImpl),
                abi.encodeCall(verifierImpl.initialize, (killSwitchAuthorizer, address(groth16Verifier)))
            )
        );
        result.zkEmailVerifier = verifierProxy;

        result.emailRecoveryCommandHandler = address(new EmailRecoveryCommandHandler{salt: create2Salt}());

        result.emailRecoveryHarness = address(
            new EmailRecoveryHarness{salt: create2Salt}(
                result.zkEmailVerifier,
                result.zkEmailDkimRegistry,
                result.zkEmailAuthImpl,
                result.emailRecoveryCommandHandler,
                minimumDelay,
                killSwitchAuthorizer
            )
        );

        vm.stopBroadcast();

        console2.log("=== DeployMockEmailRecovery (HARNESS - local only) ===");
        console2.log("chainId:", block.chainid);
        console2.log("EmailRecoveryHarness:", result.emailRecoveryHarness);
        console2.log("CommandHandler:", result.emailRecoveryCommandHandler);
        console2.log("Verifier:", result.zkEmailVerifier);
        console2.log("DKIMRegistry:", result.zkEmailDkimRegistry);
        console2.log("EmailAuthImpl:", result.zkEmailAuthImpl);

        string memory root = "root";
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");

        try vm.readFile(path) returns (string memory existingJson) {
            _trySerializeExistingAddress(root, "entryPoint", existingJson, ".entryPoint");
            _trySerializeExistingAddress(root, "usdc", existingJson, ".usdc");
            _trySerializeExistingAddress(root, "deployer", existingJson, ".deployer");
            _trySerializeExistingString(root, "infraVersion", existingJson, ".infraVersion");
            _trySerializeExistingAddress(root, "rootFactory", existingJson, ".rootFactory");
            _trySerializeExistingBool(root, "portable", existingJson, ".portable");
            _trySerializeExistingAddress(root, "smartAccountImpl", existingJson, ".smartAccountImpl");
            _trySerializeExistingAddress(root, "proxyFactory", existingJson, ".proxyFactory");
            _trySerializeExistingAddress(root, "accountFactory", existingJson, ".accountFactory");
            _trySerializeExistingAddress(root, "passkeyValidator", existingJson, ".passkeyValidator");
            _trySerializeExistingAddress(root, "socialRecovery", existingJson, ".socialRecovery");
        } catch {}

        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "emailRecovery", result.emailRecoveryHarness);
        vm.serializeAddress(root, "emailRecoveryHarness", result.emailRecoveryHarness);
        vm.serializeAddress(root, "emailRecoveryCommandHandler", result.emailRecoveryCommandHandler);
        vm.serializeAddress(root, "zkEmailVerifier", result.zkEmailVerifier);
        vm.serializeAddress(root, "zkEmailDkimRegistry", result.zkEmailDkimRegistry);
        vm.serializeAddress(root, "zkEmailAuthImpl", result.zkEmailAuthImpl);
        vm.serializeBool(root, "isHarnessDeployment", true);
        string memory json = vm.serializeBool(root, "success", true);
        vm.writeJson(json, path);

        console2.log("Deployment JSON written:", path);
    }

    function _trySerializeExistingAddress(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    ) internal {
        try vm.parseJsonAddress(existingJson, jsonPath) returns (address value) {
            vm.serializeAddress(root, key, value);
        } catch {}
    }

    function _trySerializeExistingBool(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    ) internal {
        try vm.parseJsonBool(existingJson, jsonPath) returns (bool value) {
            vm.serializeBool(root, key, value);
        } catch {}
    }

    function _trySerializeExistingString(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    ) internal {
        try vm.parseJsonString(existingJson, jsonPath) returns (string memory value) {
            vm.serializeString(root, key, value);
        } catch {}
    }
}
