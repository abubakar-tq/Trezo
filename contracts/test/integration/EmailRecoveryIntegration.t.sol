// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccountFactoryTestHelper} from "test/helpers/AccountFactoryTestHelper.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    EmailAuth,
    EmailAuthMsg,
    EmailProof
} from "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";
import {CommandUtils} from "@zk-email/ether-email-auth-contracts/src/libraries/CommandUtils.sol";
import {UserOverrideableDKIMRegistry} from "@zk-email/contracts/UserOverrideableDKIMRegistry.sol";

import {HelperConfig} from "script/HelperConfig.s.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";

import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {EmailRecoveryCommandHandler} from "email-recovery/handlers/EmailRecoveryCommandHandler.sol";
import {MockGroth16Verifier} from "lib/email-recovery/src/test/MockGroth16Verifier.sol";

import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract EmailRecoveryIntegrationTest is AccountFactoryTestHelper {
    using Strings for uint256;

    bytes32 internal constant ACCOUNT_SALT = keccak256("integration-email-recovery");
    bytes32 internal constant GUARDIAN_SALT_1 = keccak256("integration-guardian-salt-1");
    bytes32 internal constant GUARDIAN_SALT_2 = keccak256("integration-guardian-salt-2");
    bytes32 internal constant DKIM_PUBLIC_KEY_HASH =
        0x0ea9c777dc7110e5a9e89b13f0cfc540e3845ba120b2b6dc24024d61488d4788;

    string internal constant DKIM_DOMAIN = "gmail.com";

    AccountFactory internal accountFactory;
    PasskeyValidator internal passkeyValidator;
    HelperConfig internal helperConfig;
    HelperConfig.NetworkConfig internal config;
    SendPackedUserOp internal sendUserOp;
    EmailRecovery internal emailRecovery;

    MockGroth16Verifier internal verifier;
    EmailAuth internal emailAuthImpl;
    UserOverrideableDKIMRegistry internal dkimRegistry;

    address internal proxy;
    address internal entryPoint;
    address internal bundler;
    address internal spender = makeAddr("spender");
    address internal killSwitchAuthorizer;

    address[] internal guardians;
    uint256[] internal guardianWeights;
    bytes32[] internal guardianSalts;

    uint256 internal constant MINIMUM_DELAY = 1 days;
    uint256 internal constant RECOVERY_DELAY = 1 days;
    uint256 internal constant RECOVERY_EXPIRY = 3 days;
    uint256 internal constant RECOVERY_THRESHOLD = 2;
    uint256 internal nullifierCount;
    uint256 internal proofTimestamp;

    function setUp() public {
        killSwitchAuthorizer = makeAddr("kill-switch-authorizer");
        proofTimestamp = block.timestamp;

        (
            HelperConfig _helperConfig,
            ,
            ,
            AccountFactory _accountFactory,
            PasskeyValidator _passkeyValidator,
        ) = _deployLegacyAccountStack();
        helperConfig = _helperConfig;
        accountFactory = _accountFactory;
        passkeyValidator = _passkeyValidator;

        config = helperConfig.getConfig();
        entryPoint = config.entryPoint;
        sendUserOp = new SendPackedUserOp();
        bundler = makeAddr("bundler");

        proxy = _createAuthorizedAccount(
            accountFactory,
            ACCOUNT_SALT,
            0,
            address(passkeyValidator),
            PassKeyDemo.getPasskeyInit(0)
        );

        _deployZkEmailInfra();
        _deployEmailRecoveryModule();
        _installEmailRecoveryModule();
    }

    function testEmailRecoveryEndToEnd() public {
        assertTrue(
            SmartAccount(payable(proxy)).isRecoveryModule(address(emailRecovery)),
            "email recovery module should be explicitly enabled"
        );
        assertEq(passkeyValidator.passkeyCount(proxy), 1, "expected single passkey after deployment");

        _acceptGuardian(0);
        _acceptGuardian(1);

        assertTrue(emailRecovery.canStartRecoveryRequest(proxy), "accepted guardians should meet threshold");

        PasskeyTypes.PasskeyInit memory recoveredPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 recoveryHash = emailRecovery.recoveryDataHash(recoveredPasskey);

        _handleRecovery(0, recoveryHash);
        _handleRecovery(1, recoveryHash);

        (uint256 executeAfter,, uint256 currentWeight, bytes32 storedHash) =
            emailRecovery.getRecoveryRequest(proxy);
        assertEq(currentWeight, RECOVERY_THRESHOLD, "current weight should reach threshold");
        assertEq(storedHash, recoveryHash, "stored recovery hash mismatch");

        vm.warp(executeAfter + 1);
        emailRecovery.completeRecovery(proxy, abi.encode(recoveredPasskey));

        assertEq(passkeyValidator.passkeyCount(proxy), 2, "passkey count not incremented");
        assertTrue(
            passkeyValidator.hasPasskey(proxy, PasskeyValidator.PasskeyId.wrap(recoveredPasskey.idRaw)),
            "missing recovered passkey"
        );

        _sendUserOperationWithPasskey(1, PassKeyDemo.getPasskeyPrivateKey(1));

        uint256 allowance = IERC20(config.usdc).allowance(proxy, spender);
        assertEq(allowance, 1e18, "user operation did not execute through recovered passkey");
    }

    function _deployZkEmailInfra() internal {
        vm.startPrank(killSwitchAuthorizer);

        UserOverrideableDKIMRegistry dkimImpl = new UserOverrideableDKIMRegistry();
        ERC1967Proxy dkimProxy = new ERC1967Proxy(
            address(dkimImpl),
            abi.encodeCall(
                dkimImpl.initialize, (killSwitchAuthorizer, killSwitchAuthorizer, uint256(0))
            )
        );
        dkimRegistry = UserOverrideableDKIMRegistry(address(dkimProxy));
        dkimRegistry.setDKIMPublicKeyHash(
            DKIM_DOMAIN, DKIM_PUBLIC_KEY_HASH, killSwitchAuthorizer, new bytes(0)
        );

        verifier = new MockGroth16Verifier();
        emailAuthImpl = new EmailAuth();

        vm.stopPrank();
    }

    function _deployEmailRecoveryModule() internal {
        emailRecovery = new EmailRecovery(
            address(verifier),
            address(dkimRegistry),
            address(emailAuthImpl),
            address(new EmailRecoveryCommandHandler()),
            MINIMUM_DELAY,
            killSwitchAuthorizer
        );

        guardians = new address[](2);
        guardianWeights = new uint256[](2);
        guardianSalts = new bytes32[](2);

        guardianSalts[0] = GUARDIAN_SALT_1;
        guardianSalts[1] = GUARDIAN_SALT_2;

        guardians[0] = emailRecovery.computeEmailAuthAddress(proxy, guardianSalts[0]);
        guardians[1] = emailRecovery.computeEmailAuthAddress(proxy, guardianSalts[1]);

        guardianWeights[0] = 1;
        guardianWeights[1] = 1;
    }

    function _installEmailRecoveryModule() internal {
        bytes memory initData =
            abi.encode(guardians, guardianWeights, RECOVERY_THRESHOLD, RECOVERY_DELAY, RECOVERY_EXPIRY);

        bytes memory functionData = abi.encodeWithSelector(
            SmartAccount.installRecoveryExecutorModule.selector, address(emailRecovery), initData
        );
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount.execute.selector, proxy, 0, functionData);

        PackedUserOperation memory userOp =
            sendUserOp.generatePasskeySignedUserOperation(executeCalldata, config, proxy, 0);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.deal(payable(proxy), 2 ether);
        vm.deal(bundler, 2 ether);

        vm.prank(bundler);
        IEntryPoint(entryPoint).handleOps(ops, payable(bundler));

        assertTrue(
            SmartAccount(payable(proxy)).isRecoveryModule(address(emailRecovery)),
            "recovery module not enabled"
        );
    }

    function _sendUserOperationWithPasskey(uint256 passkeyIndex, bytes32 passkeyPrivateKey) internal {
        bytes memory functionData = abi.encodeWithSelector(IERC20(config.usdc).approve.selector, spender, 1e18);
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount.execute.selector, config.usdc, 0, functionData);

        PackedUserOperation memory userOp = sendUserOp.generatePasskeySignedUserOperation(
            executeCalldata, config, proxy, passkeyIndex, 1, true, passkeyPrivateKey
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.deal(payable(proxy), 2 ether);
        vm.deal(bundler, 2 ether);
        vm.prank(bundler);
        IEntryPoint(entryPoint).handleOps(ops, payable(bundler));
    }

    function _acceptGuardian(uint256 guardianIndex) internal {
        emailRecovery.handleAcceptance(_acceptanceMessage(guardianIndex), 0);
    }

    function _handleRecovery(uint256 guardianIndex, bytes32 recoveryHash) internal {
        emailRecovery.handleRecovery(_recoveryMessage(guardianIndex, recoveryHash), 0);
    }

    function _acceptanceMessage(uint256 guardianIndex) internal returns (EmailAuthMsg memory) {
        string memory accountString = CommandUtils.addressToChecksumHexString(proxy);
        string memory command = string.concat("Accept guardian request for ", accountString);

        bytes[] memory commandParams = new bytes[](1);
        commandParams[0] = abi.encode(proxy);

        return EmailAuthMsg({
            templateId: emailRecovery.computeAcceptanceTemplateId(0),
            commandParams: commandParams,
            skippedCommandPrefix: 0,
            proof: _mockEmailProof(command, guardianSalts[guardianIndex])
        });
    }

    function _recoveryMessage(uint256 guardianIndex, bytes32 recoveryHash)
        internal
        returns (EmailAuthMsg memory)
    {
        string memory accountString = CommandUtils.addressToChecksumHexString(proxy);
        string memory recoveryHashString = uint256(recoveryHash).toHexString(32);
        string memory command = string.concat(
            "Recover account ", accountString, " using recovery hash ", recoveryHashString
        );

        bytes[] memory commandParams = new bytes[](2);
        commandParams[0] = abi.encode(proxy);
        commandParams[1] = abi.encode(recoveryHashString);

        return EmailAuthMsg({
            templateId: emailRecovery.computeRecoveryTemplateId(0),
            commandParams: commandParams,
            skippedCommandPrefix: 0,
            proof: _mockEmailProof(command, guardianSalts[guardianIndex])
        });
    }

    function _mockEmailProof(string memory command, bytes32 accountSalt)
        internal
        returns (EmailProof memory proof)
    {
        proof.domainName = DKIM_DOMAIN;
        proof.publicKeyHash = DKIM_PUBLIC_KEY_HASH;
        proof.timestamp = ++proofTimestamp;
        proof.maskedCommand = command;
        proof.emailNullifier = keccak256(abi.encode(nullifierCount++));
        proof.accountSalt = accountSalt;
        proof.isCodeExist = true;
        proof.proof = bytes("0");
    }
}
