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
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";

/**
 * @notice Deploys the zk-email infra required by Trezo's custom EmailRecovery module.
 * @dev Reuses the same deployment model documented by zk-email:
 *      - if VERIFIER / DKIM_REGISTRY / EMAIL_AUTH_IMPL / COMMAND_HANDLER are supplied,
 *        the script reuses them
 *      - otherwise it deploys the missing pieces locally
 *
 * Environment variables:
 *   CREATE2_SALT                 optional, default 0x0
 *   DKIM_DELAY                   optional, default 0
 *   MINIMUM_DELAY                optional, default 0
 *   DKIM_REGISTRY                optional, reuse existing registry
 *   DKIM_SIGNER                  required only when deploying a new registry
 *   VERIFIER                     optional, reuse existing verifier proxy
 *   EMAIL_AUTH_IMPL              optional, reuse existing EmailAuth implementation
 *   COMMAND_HANDLER              optional, reuse existing EmailRecoveryCommandHandler
 *   KILL_SWITCH_AUTHORIZER       optional on local Anvil, required elsewhere
 *   ZK_EMAIL_OWNER               optional, defaults to KILL_SWITCH_AUTHORIZER
 */
contract DeployEmailRecovery is Script {
    error MissingRequiredParameter(string param);

    uint256 internal constant LOCAL_CHAIN_ID = 31337;
    address internal constant ANVIL_DEFAULT_ACCOUNT =
        0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    struct Config {
        bytes32 create2Salt;
        uint256 dkimDelay;
        uint256 minimumDelay;
        address dkimRegistry;
        address dkimSigner;
        address verifier;
        address emailAuthImpl;
        address commandHandler;
        address killSwitchAuthorizer;
        address owner;
    }

    struct DeploymentResult {
        address emailRecovery;
        address emailRecoveryCommandHandler;
        address zkEmailVerifier;
        address zkEmailDkimRegistry;
        address zkEmailAuthImpl;
        address zkEmailGroth16Verifier;
        address zkEmailVerifierImpl;
        address zkEmailDkimRegistryImpl;
    }

    function run() external returns (DeploymentResult memory result) {
        Config memory config = _loadConfig();
        _applyDefaults(config);
        _validateConfig(config);

        vm.startBroadcast();
        result = _deploy(config);
        vm.stopBroadcast();

        _writeDeploymentJson(config, result);
    }

    function _loadConfig() internal view returns (Config memory config) {
        config = Config({
            create2Salt: bytes32(vm.envOr("CREATE2_SALT", uint256(0))),
            dkimDelay: vm.envOr("DKIM_DELAY", uint256(0)),
            minimumDelay: vm.envOr("MINIMUM_DELAY", uint256(0)),
            dkimRegistry: vm.envOr("DKIM_REGISTRY", address(0)),
            dkimSigner: vm.envOr("DKIM_SIGNER", address(0)),
            verifier: vm.envOr("VERIFIER", address(0)),
            emailAuthImpl: vm.envOr("EMAIL_AUTH_IMPL", address(0)),
            commandHandler: vm.envOr("COMMAND_HANDLER", address(0)),
            killSwitchAuthorizer: vm.envOr("KILL_SWITCH_AUTHORIZER", address(0)),
            owner: vm.envOr("ZK_EMAIL_OWNER", address(0))
        });
    }

    function _applyDefaults(Config memory config) internal view {
        if (block.chainid == LOCAL_CHAIN_ID) {
            if (config.killSwitchAuthorizer == address(0)) {
                config.killSwitchAuthorizer = ANVIL_DEFAULT_ACCOUNT;
            }
            if (config.dkimRegistry == address(0) && config.dkimSigner == address(0)) {
                config.dkimSigner = ANVIL_DEFAULT_ACCOUNT;
            }
        }

        if (config.owner == address(0)) {
            config.owner = config.killSwitchAuthorizer;
        }
    }

    function _validateConfig(Config memory config) internal pure {
        if (config.killSwitchAuthorizer == address(0)) {
            revert MissingRequiredParameter("KILL_SWITCH_AUTHORIZER");
        }
        if (config.owner == address(0)) {
            revert MissingRequiredParameter("ZK_EMAIL_OWNER");
        }
        if (config.dkimRegistry == address(0) && config.dkimSigner == address(0)) {
            revert MissingRequiredParameter("DKIM_REGISTRY/DKIM_SIGNER");
        }
    }

    function _deploy(Config memory config) internal returns (DeploymentResult memory result) {
        if (config.dkimRegistry == address(0)) {
            (result.zkEmailDkimRegistry, result.zkEmailDkimRegistryImpl) = _deployDkimRegistry(config);
        } else {
            result.zkEmailDkimRegistry = config.dkimRegistry;
        }

        if (config.emailAuthImpl == address(0)) {
            result.zkEmailAuthImpl = address(new EmailAuth{salt: config.create2Salt}());
            console2.log("Deployed EmailAuth implementation:", result.zkEmailAuthImpl);
        } else {
            result.zkEmailAuthImpl = config.emailAuthImpl;
        }

        if (config.verifier == address(0)) {
            (result.zkEmailVerifier, result.zkEmailVerifierImpl, result.zkEmailGroth16Verifier) =
                _deployVerifier(config);
        } else {
            result.zkEmailVerifier = config.verifier;
        }

        if (config.commandHandler == address(0)) {
            result.emailRecoveryCommandHandler =
                address(new EmailRecoveryCommandHandler{salt: config.create2Salt}());
            console2.log(
                "Deployed EmailRecoveryCommandHandler:", result.emailRecoveryCommandHandler
            );
        } else {
            result.emailRecoveryCommandHandler = config.commandHandler;
        }

        result.emailRecovery = address(
            new EmailRecovery{salt: config.create2Salt}(
                result.zkEmailVerifier,
                result.zkEmailDkimRegistry,
                result.zkEmailAuthImpl,
                result.emailRecoveryCommandHandler,
                config.minimumDelay,
                config.killSwitchAuthorizer
            )
        );

        console2.log("=== DeployEmailRecovery ===");
        console2.log("chainId:", block.chainid);
        console2.log("EmailRecovery:", result.emailRecovery);
        console2.log("CommandHandler:", result.emailRecoveryCommandHandler);
        console2.log("Verifier:", result.zkEmailVerifier);
        console2.log("DKIMRegistry:", result.zkEmailDkimRegistry);
        console2.log("EmailAuthImpl:", result.zkEmailAuthImpl);

        return result;
    }

    function _deployDkimRegistry(Config memory config)
        internal
        returns (address proxy, address implementation)
    {
        implementation = address(new UserOverrideableDKIMRegistry{salt: config.create2Salt}());
        proxy = address(
            new ERC1967Proxy{salt: config.create2Salt}(
                implementation,
                abi.encodeCall(
                    UserOverrideableDKIMRegistry(implementation).initialize,
                    (config.owner, config.dkimSigner, config.dkimDelay)
                )
            )
        );

        console2.log("Deployed DKIMRegistry implementation:", implementation);
        console2.log("Deployed DKIMRegistry proxy:", proxy);
    }

    function _deployVerifier(Config memory config)
        internal
        returns (address proxy, address implementation, address groth16Verifier)
    {
        implementation = address(new Verifier{salt: config.create2Salt}());
        groth16Verifier = address(new Groth16Verifier{salt: config.create2Salt}());
        proxy = address(
            new ERC1967Proxy{salt: config.create2Salt}(
                implementation,
                abi.encodeCall(Verifier(implementation).initialize, (config.owner, groth16Verifier))
            )
        );

        console2.log("Deployed Verifier implementation:", implementation);
        console2.log("Deployed Groth16Verifier:", groth16Verifier);
        console2.log("Deployed Verifier proxy:", proxy);
    }

    function _writeDeploymentJson(Config memory config, DeploymentResult memory result) internal {
        string memory root = "root";
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");

        _preserveCoreDeployment(root, path);
        _preserveExistingEmailRecoveryDeployment(root, path);

        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "emailRecovery", result.emailRecovery);
        vm.serializeAddress(root, "emailRecoveryCommandHandler", result.emailRecoveryCommandHandler);
        vm.serializeAddress(root, "zkEmailVerifier", result.zkEmailVerifier);
        vm.serializeAddress(root, "zkEmailDkimRegistry", result.zkEmailDkimRegistry);
        vm.serializeAddress(root, "zkEmailAuthImpl", result.zkEmailAuthImpl);
        vm.serializeAddress(root, "zkEmailGroth16Verifier", result.zkEmailGroth16Verifier);
        vm.serializeAddress(root, "zkEmailVerifierImpl", result.zkEmailVerifierImpl);
        vm.serializeAddress(root, "zkEmailDkimRegistryImpl", result.zkEmailDkimRegistryImpl);
        vm.serializeAddress(root, "emailRecoveryKillSwitchAuthorizer", config.killSwitchAuthorizer);
        vm.serializeUint(root, "emailRecoveryMinimumDelay", config.minimumDelay);

        string memory json = vm.serializeBool(root, "success", true);
        vm.writeJson(json, path);

        console2.log("Deployment JSON written:", path);
    }

    function _preserveCoreDeployment(string memory root, string memory path) internal {
        try vm.readFile(path) returns (string memory existingJson) {
            _trySerializeExistingUint(root, "chainId", existingJson, ".chainId");
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
            _trySerializeExistingBool(root, "success", existingJson, ".success");
        } catch { }
    }

    function _preserveExistingEmailRecoveryDeployment(string memory root, string memory path)
        internal
    {
        try vm.readFile(path) returns (string memory existingJson) {
            _trySerializeExistingAddress(root, "emailRecovery", existingJson, ".emailRecovery");
            _trySerializeExistingAddress(
                root,
                "emailRecoveryCommandHandler",
                existingJson,
                ".emailRecoveryCommandHandler"
            );
            _trySerializeExistingAddress(root, "zkEmailVerifier", existingJson, ".zkEmailVerifier");
            _trySerializeExistingAddress(
                root,
                "zkEmailDkimRegistry",
                existingJson,
                ".zkEmailDkimRegistry"
            );
            _trySerializeExistingAddress(root, "zkEmailAuthImpl", existingJson, ".zkEmailAuthImpl");
            _trySerializeExistingAddress(
                root,
                "zkEmailGroth16Verifier",
                existingJson,
                ".zkEmailGroth16Verifier"
            );
            _trySerializeExistingAddress(
                root,
                "zkEmailVerifierImpl",
                existingJson,
                ".zkEmailVerifierImpl"
            );
            _trySerializeExistingAddress(
                root,
                "zkEmailDkimRegistryImpl",
                existingJson,
                ".zkEmailDkimRegistryImpl"
            );
            _trySerializeExistingAddress(
                root,
                "emailRecoveryKillSwitchAuthorizer",
                existingJson,
                ".emailRecoveryKillSwitchAuthorizer"
            );
            _trySerializeExistingUint(
                root,
                "emailRecoveryMinimumDelay",
                existingJson,
                ".emailRecoveryMinimumDelay"
            );
        } catch { }
    }

    function _trySerializeExistingAddress(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    )
        internal
    {
        try vm.parseJsonAddress(existingJson, jsonPath) returns (address value) {
            vm.serializeAddress(root, key, value);
        } catch { }
    }

    function _trySerializeExistingUint(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    )
        internal
    {
        try vm.parseJsonUint(existingJson, jsonPath) returns (uint256 value) {
            vm.serializeUint(root, key, value);
        } catch { }
    }

    function _trySerializeExistingBool(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    )
        internal
    {
        try vm.parseJsonBool(existingJson, jsonPath) returns (bool value) {
            vm.serializeBool(root, key, value);
        } catch { }
    }

    function _trySerializeExistingString(
        string memory root,
        string memory key,
        string memory existingJson,
        string memory jsonPath
    )
        internal
    {
        try vm.parseJsonString(existingJson, jsonPath) returns (string memory value) {
            vm.serializeString(root, key, value);
        } catch { }
    }
}
