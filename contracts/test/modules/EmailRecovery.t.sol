// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccountFactoryTestHelper} from "test/helpers/AccountFactoryTestHelper.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {
    EmailAuth,
    EmailAuthMsg,
    EmailProof
} from "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";
import {CommandUtils} from "@zk-email/ether-email-auth-contracts/src/libraries/CommandUtils.sol";
import {UserOverrideableDKIMRegistry} from "@zk-email/contracts/UserOverrideableDKIMRegistry.sol";

import {DeployAccount} from "script/DeployAccount.s.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {EmailRecoveryCommandHandler} from "email-recovery/handlers/EmailRecoveryCommandHandler.sol";
import {MockGroth16Verifier} from "lib/email-recovery/src/test/MockGroth16Verifier.sol";
import {IEmailRecoveryManager} from "lib/email-recovery/src/interfaces/IEmailRecoveryManager.sol";
import {IGuardianManager} from "lib/email-recovery/src/interfaces/IGuardianManager.sol";
import {
    GuardianStorage,
    GuardianStatus
} from "lib/email-recovery/src/libraries/EnumerableGuardianMap.sol";

contract EmailRecoveryTest is AccountFactoryTestHelper {
    using Strings for uint256;

    bytes32 internal constant ACCOUNT_SALT = keccak256("email-recovery-account");
    bytes32 internal constant GUARDIAN_SALT_1 = keccak256("guardian-salt-1");
    bytes32 internal constant GUARDIAN_SALT_2 = keccak256("guardian-salt-2");
    bytes32 internal constant GUARDIAN_SALT_3 = keccak256("guardian-salt-3");
    bytes32 internal constant DKIM_PUBLIC_KEY_HASH =
        0x0ea9c777dc7110e5a9e89b13f0cfc540e3845ba120b2b6dc24024d61488d4788;

    string internal constant DKIM_DOMAIN = "gmail.com";

    AccountFactory internal accountFactory;
    PasskeyValidator internal passkeyValidator;
    EmailRecovery internal emailRecovery;

    MockGroth16Verifier internal verifier;
    EmailAuth internal emailAuthImpl;
    UserOverrideableDKIMRegistry internal dkimRegistry;

    address internal proxy;
    address internal killSwitchAuthorizer;
    address[] internal guardians;
    uint256[] internal guardianWeights;
    bytes32[] internal guardianSalts;

    uint256 internal constant MINIMUM_DELAY = 1 days;
    uint256 internal constant RECOVERY_DELAY = 1 days;
    uint256 internal constant RECOVERY_EXPIRY = 3 days;
    uint256 internal constant RECOVERY_THRESHOLD = 3;
    uint256 internal nullifierCount;
    uint256 internal proofTimestamp;

    function setUp() public {
        killSwitchAuthorizer = makeAddr("kill-switch-authorizer");
        proofTimestamp = block.timestamp;

        DeployAccount deployScript = new DeployAccount();
        (, , , accountFactory, passkeyValidator,) = deployScript.deployAccount();

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

    function testInstallConfiguresRecoveryAndRequiresExplicitRecoveryTrust() public view {
        assertTrue(
            SmartAccount(payable(proxy)).isRecoveryModule(address(emailRecovery)),
            "email recovery module should be explicitly enabled"
        );

        IGuardianManager.GuardianConfig memory guardianConfig = emailRecovery.getGuardianConfig(proxy);
        assertEq(guardianConfig.guardianCount, 3, "guardian count");
        assertEq(guardianConfig.totalWeight, 4, "total guardian weight");
        assertEq(guardianConfig.acceptedWeight, 0, "accepted guardian weight");
        assertEq(guardianConfig.threshold, RECOVERY_THRESHOLD, "recovery threshold");

        IEmailRecoveryManager.RecoveryConfig memory recoveryConfig = emailRecovery.getRecoveryConfig(proxy);
        assertEq(recoveryConfig.delay, RECOVERY_DELAY, "recovery delay");
        assertEq(recoveryConfig.expiry, RECOVERY_EXPIRY, "recovery expiry");

        assertFalse(emailRecovery.canStartRecoveryRequest(proxy), "accepted guardians below threshold");
    }

    function testOnInstallRejectsEmptyData() public {
        vm.expectRevert(EmailRecovery.InvalidOnInstallData.selector);
        emailRecovery.onInstall("");
    }

    function testGuardianAcceptanceEnablesRecoveryThreshold() public {
        _acceptGuardian(0);

        IGuardianManager.GuardianConfig memory guardianConfig = emailRecovery.getGuardianConfig(proxy);
        assertEq(guardianConfig.acceptedWeight, 1, "accepted weight after first acceptance");
        assertFalse(emailRecovery.canStartRecoveryRequest(proxy), "threshold not met yet");

        _acceptGuardian(1);

        guardianConfig = emailRecovery.getGuardianConfig(proxy);
        assertEq(guardianConfig.acceptedWeight, 3, "accepted weight after second acceptance");
        assertTrue(emailRecovery.canStartRecoveryRequest(proxy), "threshold should be met");

        GuardianStorage memory guardian = emailRecovery.getGuardian(proxy, guardians[1]);
        assertEq(uint256(guardian.status), uint256(GuardianStatus.ACCEPTED), "guardian not accepted");
    }

    function testHandleRecoveryRejectsMismatchedRecoveryHash() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 recoveryHash = emailRecovery.recoveryDataHash(newPasskey);
        bytes32 wrongHash = keccak256("wrong-recovery-hash");

        _handleRecovery(0, recoveryHash);
        EmailAuthMsg memory mismatchedRecovery = _recoveryMessage(1, wrongHash);

        vm.expectRevert(
            abi.encodeWithSelector(
                IEmailRecoveryManager.InvalidRecoveryDataHash.selector, wrongHash, recoveryHash
            )
        );
        emailRecovery.handleRecovery(mismatchedRecovery, 0);
    }

    function testCompleteRecoveryRevertsBeforeDelay() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 recoveryHash = emailRecovery.recoveryDataHash(newPasskey);

        _handleRecovery(0, recoveryHash);
        _handleRecovery(1, recoveryHash);

        (uint256 executeAfter,, uint256 currentWeight,) = emailRecovery.getRecoveryRequest(proxy);
        assertEq(currentWeight, RECOVERY_THRESHOLD, "current weight should reach threshold");

        vm.expectRevert(
            abi.encodeWithSelector(
                IEmailRecoveryManager.DelayNotPassed.selector, block.timestamp, executeAfter
            )
        );
        emailRecovery.completeRecovery(proxy, abi.encode(newPasskey));
    }

    function testCompleteRecoveryRequiresThresholdWeight() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 recoveryHash = emailRecovery.recoveryDataHash(newPasskey);

        _handleRecovery(0, recoveryHash);

        vm.expectRevert(
            abi.encodeWithSelector(
                IEmailRecoveryManager.NotEnoughApprovals.selector, guardianWeights[0], RECOVERY_THRESHOLD
            )
        );
        emailRecovery.completeRecovery(proxy, abi.encode(newPasskey));
    }

    function testCompleteRecoveryAddsNewPasskey() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 recoveryHash = emailRecovery.recoveryDataHash(newPasskey);

        _handleRecovery(0, recoveryHash);
        _handleRecovery(1, recoveryHash);

        (uint256 executeAfter, uint256 executeBefore, uint256 currentWeight, bytes32 storedHash) =
            emailRecovery.getRecoveryRequest(proxy);
        assertEq(currentWeight, RECOVERY_THRESHOLD, "current weight");
        assertEq(storedHash, recoveryHash, "stored recovery hash");

        vm.warp(executeAfter + 1);
        emailRecovery.completeRecovery(proxy, abi.encode(newPasskey));

        assertEq(passkeyValidator.passkeyCount(proxy), 2, "new passkey should be added");
        assertTrue(
            passkeyValidator.hasPasskey(proxy, PasskeyValidator.PasskeyId.wrap(newPasskey.idRaw)),
            "validator should contain recovered passkey"
        );

        (uint256 clearedExecuteAfter, uint256 clearedExecuteBefore, uint256 clearedWeight, bytes32 clearedHash) =
            emailRecovery.getRecoveryRequest(proxy);
        assertEq(clearedExecuteAfter, 0, "executeAfter should be cleared");
        assertEq(clearedExecuteBefore, 0, "executeBefore should be cleared");
        assertEq(clearedWeight, 0, "current weight should be cleared");
        assertEq(clearedHash, bytes32(0), "recovery hash should be cleared");
        assertTrue(block.timestamp < executeBefore, "recovery must complete before expiry");
    }

    function testKillSwitchBlocksRecoveryRequests() public {
        _acceptThresholdGuardians();
        assertTrue(emailRecovery.canStartRecoveryRequest(proxy), "threshold should be met");

        vm.prank(killSwitchAuthorizer);
        emailRecovery.toggleKillSwitch();

        assertFalse(emailRecovery.canStartRecoveryRequest(proxy), "kill switch should block recovery");

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        EmailAuthMsg memory recoveryMessage =
            _recoveryMessage(0, emailRecovery.recoveryDataHash(newPasskey));

        vm.expectRevert(abi.encodeWithSelector(IGuardianManager.KillSwitchEnabled.selector));
        emailRecovery.handleRecovery(recoveryMessage, 0);
    }

    function testCompleteRecoveryRejectsInvalidPasskeyCoordinates() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory invalidPasskey = PassKeyDemo.getPasskeyInit(1);
        invalidPasskey.px = 0;

        bytes32 recoveryHash = emailRecovery.recoveryDataHash(invalidPasskey);
        _handleRecovery(0, recoveryHash);
        _handleRecovery(1, recoveryHash);

        (uint256 executeAfter,,,) = emailRecovery.getRecoveryRequest(proxy);
        vm.warp(executeAfter + 1);

        vm.expectRevert(EmailRecovery.InvalidPasskeyCoordinates.selector);
        emailRecovery.completeRecovery(proxy, abi.encode(invalidPasskey));
    }

    function testCompleteRecoveryRejectsZeroPasskeyId() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory invalidPasskey = PassKeyDemo.getPasskeyInit(1);
        invalidPasskey.idRaw = bytes32(0);

        bytes32 recoveryHash = emailRecovery.recoveryDataHash(invalidPasskey);
        _handleRecovery(0, recoveryHash);
        _handleRecovery(1, recoveryHash);

        (uint256 executeAfter,,,) = emailRecovery.getRecoveryRequest(proxy);
        vm.warp(executeAfter + 1);

        vm.expectRevert(
            abi.encodeWithSelector(EmailRecovery.InvalidPasskey.selector, bytes32(0))
        );
        emailRecovery.completeRecovery(proxy, abi.encode(invalidPasskey));
    }

    function testCompleteRecoveryRejectsExpiredRequests() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 recoveryHash = emailRecovery.recoveryDataHash(newPasskey);

        _handleRecovery(0, recoveryHash);
        _handleRecovery(1, recoveryHash);

        (, uint256 executeBefore,,) = emailRecovery.getRecoveryRequest(proxy);
        vm.warp(executeBefore + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IEmailRecoveryManager.RecoveryRequestExpired.selector, block.timestamp, executeBefore
            )
        );
        emailRecovery.completeRecovery(proxy, abi.encode(newPasskey));
    }

    function testActiveRecoveryBlocksNewRequestsUntilCleared() public {
        _acceptThresholdGuardians();
        assertTrue(emailRecovery.canStartRecoveryRequest(proxy), "recovery should be startable");

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes32 recoveryHash = emailRecovery.recoveryDataHash(newPasskey);

        _handleRecovery(0, recoveryHash);
        assertFalse(emailRecovery.canStartRecoveryRequest(proxy), "active request should block new recovery");

        _handleRecovery(1, recoveryHash);
        assertFalse(emailRecovery.canStartRecoveryRequest(proxy), "ready request should still block new recovery");

        (uint256 executeAfter,,,) = emailRecovery.getRecoveryRequest(proxy);
        vm.warp(executeAfter + 1);
        emailRecovery.completeRecovery(proxy, abi.encode(newPasskey));

        assertTrue(emailRecovery.canStartRecoveryRequest(proxy), "cleared request should allow new recovery");
    }

    function testOnUninstallClearsGuardianConfiguration() public {
        vm.prank(proxy);
        emailRecovery.onUninstall("");

        IGuardianManager.GuardianConfig memory guardianConfig = emailRecovery.getGuardianConfig(proxy);
        assertEq(guardianConfig.guardianCount, 0, "guardian count should be cleared");
        assertEq(guardianConfig.totalWeight, 0, "guardian weight should be cleared");
        assertEq(guardianConfig.acceptedWeight, 0, "accepted weight should be cleared");
        assertEq(guardianConfig.threshold, 0, "threshold should be cleared");
        assertFalse(emailRecovery.isInitialized(proxy), "module should be uninitialized");
        assertFalse(emailRecovery.canStartRecoveryRequest(proxy), "uninstalled module cannot start recovery");
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

        guardians = new address[](3);
        guardianWeights = new uint256[](3);
        guardianSalts = new bytes32[](3);

        guardianSalts[0] = GUARDIAN_SALT_1;
        guardianSalts[1] = GUARDIAN_SALT_2;
        guardianSalts[2] = GUARDIAN_SALT_3;

        guardians[0] = emailRecovery.computeEmailAuthAddress(proxy, guardianSalts[0]);
        guardians[1] = emailRecovery.computeEmailAuthAddress(proxy, guardianSalts[1]);
        guardians[2] = emailRecovery.computeEmailAuthAddress(proxy, guardianSalts[2]);

        guardianWeights[0] = 1;
        guardianWeights[1] = 2;
        guardianWeights[2] = 1;
    }

    function _installEmailRecoveryModule() internal {
        bytes memory initData =
            abi.encode(guardians, guardianWeights, RECOVERY_THRESHOLD, RECOVERY_DELAY, RECOVERY_EXPIRY);

        vm.prank(proxy);
        SmartAccount(payable(proxy)).installRecoveryExecutorModule(address(emailRecovery), initData);
    }

    function _acceptThresholdGuardians() internal {
        _acceptGuardian(0);
        _acceptGuardian(1);
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
