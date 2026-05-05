// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccountFactoryTestHelper} from "test/helpers/AccountFactoryTestHelper.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {EmailAuth} from "@zk-email/ether-email-auth-contracts/src/EmailAuth.sol";
import {UserOverrideableDKIMRegistry} from "@zk-email/contracts/UserOverrideableDKIMRegistry.sol";

import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {RecoveryHash} from "src/recovery/RecoveryHash.sol";
import {RecoveryTypes} from "src/recovery/RecoveryTypes.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";
import {EmailRecoveryHarness} from "test/harness/EmailRecoveryHarness.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {EmailRecoveryCommandHandler} from "email-recovery/handlers/EmailRecoveryCommandHandler.sol";
import {MockGroth16Verifier} from "lib/email-recovery/src/test/MockGroth16Verifier.sol";
import {IEmailRecoveryManager} from "lib/email-recovery/src/interfaces/IEmailRecoveryManager.sol";
import {IGuardianManager} from "lib/email-recovery/src/interfaces/IGuardianManager.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title EmailRecoveryMultichainHarnessTest
 * @notice Tests the real completeRecovery(account, recoveryData) path through the dev-only
 *         EmailRecoveryHarness, simulating ZK Email manager state without real email proofs.
 *
 *         These tests prove that if ZK Email's EmailRecoveryManager has accepted guardian
 *         approvals and completeRecovery is called, our EmailRecovery module correctly
 *         decodes multichain recoveryData, validates local chain scope, and adds the new
 *         passkey through SmartAccount.addPasskeyFromRecovery.
 *
 *         The harness is only used to set up guardian acceptance and recovery voting state.
 *         The actual recovery execution always goes through the real completeRecovery().
 */
contract EmailRecoveryMultichainHarnessTest is AccountFactoryTestHelper {
    using Strings for uint256;

    bytes32 internal constant ACCOUNT_SALT = keccak256("harness-email-recovery");
    bytes32 internal constant DKIM_PUBLIC_KEY_HASH = 0x0ea9c777dc7110e5a9e89b13f0cfc540e3845ba120b2b6dc24024d61488d4788;
    string internal constant DKIM_DOMAIN = "gmail.com";

    AccountFactory internal accountFactory;
    PasskeyValidator internal passkeyValidator;
    EmailRecoveryHarness internal harness;

    MockGroth16Verifier internal verifier;
    EmailAuth internal emailAuthImpl;
    UserOverrideableDKIMRegistry internal dkimRegistry;
    EmailRecoveryCommandHandler internal commandHandler;

    address internal proxy;
    address internal killSwitchAuthorizer;
    address[] internal guardians;
    uint256[] internal guardianWeights;

    uint256 internal constant MINIMUM_DELAY = 1 days;
    uint256 internal constant RECOVERY_DELAY = 1 days;
    uint256 internal constant RECOVERY_EXPIRY = 3 days;
    uint256 internal constant RECOVERY_THRESHOLD = 2;

    function setUp() public {
        killSwitchAuthorizer = makeAddr("kill-switch-authorizer");

        (,,, accountFactory, passkeyValidator,) = _deployAccountStack();

        proxy = _createAuthorizedAccount(
            accountFactory, ACCOUNT_SALT, 0, address(passkeyValidator), PassKeyDemo.getPasskeyInit(0)
        );

        _deployZkEmailInfra();
        _deployHarness();
        _installHarness();
    }

    // ──────────────────────────────────────────────────────────────
    //  Happy path: completeRecovery adds passkey, increments nonce
    // ──────────────────────────────────────────────────────────────

    function testCompleteRecoveryAddsNewPasskey() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes memory recoveryData = _validMultichainRecoveryData(newPasskey);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        emailRecovery().completeRecovery(proxy, recoveryData);

        assertEq(passkeyValidator.passkeyCount(proxy), 2, "new passkey should be added");
        assertTrue(
            passkeyValidator.hasPasskey(proxy, PasskeyValidator.PasskeyId.wrap(newPasskey.idRaw)),
            "validator should contain recovered passkey"
        );
        assertEq(emailRecovery().getRecoveryNonce(proxy), 1, "nonce should increment");
    }

    // ──────────────────────────────────────────────────────────────
    //  Replay with same recoveryData fails after nonce increment
    // ──────────────────────────────────────────────────────────────

    function testReplaySameRecoveryDataFailsAfterNonceIncrement() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes memory recoveryData = _validMultichainRecoveryData(newPasskey);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();
        emailRecovery().completeRecovery(proxy, recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        vm.expectRevert(abi.encodeWithSelector(EmailRecovery.EmailRecoveryScopeNonceMismatch.selector, 1, 0));
        emailRecovery().completeRecovery(proxy, recoveryData);
    }

    // ──────────────────────────────────────────────────────────────
    //  Chain not in scope
    // ──────────────────────────────────────────────────────────────

    function testCompleteRecoveryRejectsChainNotInScope() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _singleScope();
        scopes[0].chainId = block.chainid + 1;
        bytes memory recoveryData = _multichainRecoveryData(newPasskey, scopes);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        vm.expectRevert(abi.encodeWithSelector(EmailRecovery.EmailRecoveryChainNotInScope.selector, block.chainid));
        emailRecovery().completeRecovery(proxy, recoveryData);
    }

    // ──────────────────────────────────────────────────────────────
    //  Wrong nonce
    // ──────────────────────────────────────────────────────────────

    function testCompleteRecoveryRejectsWrongNonce() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _singleScope();
        scopes[0].nonce = 99;
        bytes memory recoveryData = _multichainRecoveryData(newPasskey, scopes);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        vm.expectRevert(abi.encodeWithSelector(EmailRecovery.EmailRecoveryScopeNonceMismatch.selector, 0, 99));
        emailRecovery().completeRecovery(proxy, recoveryData);
    }

    // ──────────────────────────────────────────────────────────────
    //  Wrong guardianSetHash
    // ──────────────────────────────────────────────────────────────

    function testCompleteRecoveryRejectsWrongGuardianSetHash() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _singleScope();
        scopes[0].guardianSetHash = keccak256("wrong-guardian-set");
        bytes memory recoveryData = _multichainRecoveryData(newPasskey, scopes);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        vm.expectRevert(EmailRecovery.EmailRecoveryGuardianSetChanged.selector);
        emailRecovery().completeRecovery(proxy, recoveryData);
    }

    // ──────────────────────────────────────────────────────────────
    //  Wrong policyHash
    // ──────────────────────────────────────────────────────────────

    function testCompleteRecoveryRejectsWrongPolicyHash() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _singleScope();
        scopes[0].policyHash = keccak256("wrong-policy");
        bytes memory recoveryData = _multichainRecoveryData(newPasskey, scopes);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        vm.expectRevert(EmailRecovery.EmailRecoveryPolicyChanged.selector);
        emailRecovery().completeRecovery(proxy, recoveryData);
    }

    // ──────────────────────────────────────────────────────────────
    //  Expired deadline
    // ──────────────────────────────────────────────────────────────

    function testCompleteRecoveryRejectsExpiredDeadline() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        uint48 deadline = uint48(block.timestamp + 1 hours);
        bytes memory recoveryData = _multichainRecoveryDataWithDeadline(newPasskey, _singleScope(), deadline);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        vm.expectRevert(abi.encodeWithSelector(EmailRecovery.EmailRecoveryDeadlineExpired.selector, deadline));
        emailRecovery().completeRecovery(proxy, recoveryData);
    }

    // ──────────────────────────────────────────────────────────────
    //  Multichain with two chains — only local chain processes
    // ──────────────────────────────────────────────────────────────

    function testMultichainTwoChainsLocalScopeValidates() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);

        RecoveryTypes.RecoveryModuleScope[] memory scopes = new RecoveryTypes.RecoveryModuleScope[](2);
        scopes[0] = _scopeEntry(block.chainid, proxy, address(harness), 0);
        scopes[1] = _scopeEntry(block.chainid + 1, proxy, address(harness), 0);

        bytes memory recoveryData = _multichainRecoveryData(newPasskey, scopes);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        emailRecovery().completeRecovery(proxy, recoveryData);

        assertEq(passkeyValidator.passkeyCount(proxy), 2, "passkey should be added");
        assertEq(emailRecovery().getRecoveryNonce(proxy), 1, "nonce should increment");
    }

    // ──────────────────────────────────────────────────────────────
    //  Legacy 96-byte path still works
    // ──────────────────────────────────────────────────────────────

    function testLegacyRecoveryPathStillWorks() public {
        _acceptThresholdGuardians();

        PasskeyTypes.PasskeyInit memory newPasskey = PassKeyDemo.getPasskeyInit(1);
        bytes memory recoveryData = abi.encode(newPasskey);
        bytes32 recoveryHash = keccak256(recoveryData);

        _voteForRecovery(recoveryHash);
        _warpPastDelay();

        emailRecovery().completeRecovery(proxy, recoveryData);

        assertEq(passkeyValidator.passkeyCount(proxy), 2, "legacy passkey should be added");
    }

    // ══════════════════════════════════════════════════════════════
    //  Internal helpers
    // ══════════════════════════════════════════════════════════════

    function emailRecovery() internal view returns (EmailRecovery) {
        return EmailRecovery(address(harness));
    }

    function _deployZkEmailInfra() internal {
        vm.startPrank(killSwitchAuthorizer);

        UserOverrideableDKIMRegistry dkimImpl = new UserOverrideableDKIMRegistry();
        ERC1967Proxy dkimProxy = new ERC1967Proxy(
            address(dkimImpl),
            abi.encodeCall(dkimImpl.initialize, (killSwitchAuthorizer, killSwitchAuthorizer, uint256(0)))
        );
        dkimRegistry = UserOverrideableDKIMRegistry(address(dkimProxy));
        dkimRegistry.setDKIMPublicKeyHash(DKIM_DOMAIN, DKIM_PUBLIC_KEY_HASH, killSwitchAuthorizer, new bytes(0));

        verifier = new MockGroth16Verifier();
        emailAuthImpl = new EmailAuth();

        vm.stopPrank();
    }

    function _deployHarness() internal {
        commandHandler = new EmailRecoveryCommandHandler();

        harness = new EmailRecoveryHarness(
            address(verifier),
            address(dkimRegistry),
            address(emailAuthImpl),
            address(commandHandler),
            MINIMUM_DELAY,
            killSwitchAuthorizer
        );

        guardians = new address[](3);
        guardianWeights = new uint256[](3);

        bytes32 salt0 = keccak256("harness-guardian-salt-0");
        bytes32 salt1 = keccak256("harness-guardian-salt-1");
        bytes32 salt2 = keccak256("harness-guardian-salt-2");

        guardians[0] = harness.computeEmailAuthAddress(proxy, salt0);
        guardians[1] = harness.computeEmailAuthAddress(proxy, salt1);
        guardians[2] = harness.computeEmailAuthAddress(proxy, salt2);

        guardianWeights[0] = 1;
        guardianWeights[1] = 2;
        guardianWeights[2] = 1;
    }

    function _installHarness() internal {
        bytes memory initData =
            abi.encode(guardians, guardianWeights, RECOVERY_THRESHOLD, RECOVERY_DELAY, RECOVERY_EXPIRY);

        vm.prank(proxy);
        SmartAccount(payable(proxy)).installRecoveryExecutorModule(address(harness), initData);
    }

    function _acceptThresholdGuardians() internal {
        bytes[] memory commandParams = new bytes[](1);
        commandParams[0] = abi.encode(proxy);

        harness.exposedAcceptGuardian(guardians[0], 0, commandParams);
        harness.exposedAcceptGuardian(guardians[1], 0, commandParams);
    }

    function _voteForRecovery(bytes32 recoveryHash) internal {
        string memory accountString = _checksumAddress(proxy);
        string memory recoveryHashString = uint256(recoveryHash).toHexString(32);

        bytes[] memory commandParams = new bytes[](2);
        commandParams[0] = abi.encode(proxy);
        commandParams[1] = abi.encode(recoveryHashString);

        harness.exposedProcessRecovery(guardians[0], 0, commandParams);
        harness.exposedProcessRecovery(guardians[1], 0, commandParams);
    }

    function _warpPastDelay() internal {
        (uint256 executeAfter,,,) = emailRecovery().getRecoveryRequest(proxy);
        vm.warp(executeAfter + 1);
    }

    function _validMultichainRecoveryData(PasskeyTypes.PasskeyInit memory newPasskey)
        internal
        view
        returns (bytes memory)
    {
        return _multichainRecoveryData(newPasskey, _singleScope());
    }

    function _multichainRecoveryData(
        PasskeyTypes.PasskeyInit memory newPasskey,
        RecoveryTypes.RecoveryModuleScope[] memory scopes
    ) internal view returns (bytes memory) {
        return _multichainRecoveryDataWithDeadline(newPasskey, scopes, uint48(block.timestamp + 30 days));
    }

    function _multichainRecoveryDataWithDeadline(
        PasskeyTypes.PasskeyInit memory newPasskey,
        RecoveryTypes.RecoveryModuleScope[] memory scopes,
        uint48 deadline
    ) internal pure returns (bytes memory) {
        RecoveryTypes.RecoveryIntent memory intent = RecoveryTypes.RecoveryIntent({
            requestId: keccak256("harness-recovery-request"),
            newPasskeyHash: RecoveryHash.hashPasskeyInitMemory(newPasskey),
            chainScopeHash: RecoveryHash.hashChainScopesMemory(scopes),
            validAfter: 0,
            deadline: deadline,
            metadataHash: bytes32(0)
        });

        return abi.encode(uint8(1), newPasskey, intent, scopes);
    }

    function _singleScope() internal view returns (RecoveryTypes.RecoveryModuleScope[] memory) {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = new RecoveryTypes.RecoveryModuleScope[](1);
        scopes[0] = _scopeEntry(block.chainid, proxy, address(harness), emailRecovery().getRecoveryNonce(proxy));
        return scopes;
    }

    function _scopeEntry(uint256 chainId, address wallet, address module, uint256 nonce)
        internal
        view
        returns (RecoveryTypes.RecoveryModuleScope memory)
    {
        return RecoveryTypes.RecoveryModuleScope({
            chainId: chainId,
            wallet: wallet,
            recoveryModule: module,
            nonce: nonce,
            guardianSetHash: emailRecovery().getGuardianSetHash(wallet),
            policyHash: emailRecovery().getPolicyHash(wallet)
        });
    }

    function _checksumAddress(address a) internal pure returns (string memory) {
        return Strings.toHexString(uint160(a));
    }
}
