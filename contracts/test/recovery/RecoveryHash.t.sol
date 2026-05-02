// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {RecoveryHash} from "src/recovery/RecoveryHash.sol";
import {RecoveryTypes} from "src/recovery/RecoveryTypes.sol";

contract RecoveryHashHarness {
    function hashPasskey(PasskeyTypes.PasskeyInit memory passkey) external pure returns (bytes32) {
        return RecoveryHash.hashPasskeyInitMemory(passkey);
    }

    function hashLegacyScopes(RecoveryTypes.ChainRecoveryScope[] calldata scopes) external pure returns (bytes32) {
        return RecoveryHash.hashChainScopes(scopes);
    }

    function hashScope(RecoveryTypes.RecoveryModuleScope calldata scope) external pure returns (bytes32) {
        return RecoveryHash.hashChainScope(scope);
    }

    function hashScopes(RecoveryTypes.RecoveryModuleScope[] calldata scopes) external pure returns (bytes32) {
        return RecoveryHash.hashChainScopes(scopes);
    }

    function hashIntent(RecoveryTypes.RecoveryIntent calldata intent) external pure returns (bytes32) {
        return RecoveryHash.hashRecoveryIntent(intent);
    }

    function hashEmailRecoveryData(RecoveryTypes.EmailRecoveryData calldata data) external pure returns (bytes32) {
        return RecoveryHash.hashEmailRecoveryData(data);
    }

    function digest(address verifyingContract, RecoveryTypes.RecoveryIntent calldata intent)
        external
        pure
        returns (bytes32)
    {
        return RecoveryHash.hashPortableTypedData(verifyingContract, RecoveryHash.hashRecoveryIntent(intent));
    }
}

contract RecoveryHashTest is Test {
    RecoveryHashHarness internal harness;

    address internal constant WALLET = 0x1111111111111111111111111111111111111111;
    address internal constant MODULE_A = 0x2222222222222222222222222222222222222222;
    address internal constant MODULE_B = 0x3333333333333333333333333333333333333333;
    bytes32 internal constant REQUEST_ID = bytes32(uint256(0xA11CE));
    bytes32 internal constant METADATA_HASH = bytes32(uint256(0xB0B));
    uint48 internal constant DEADLINE = 1_800_000_000;

    function setUp() public {
        harness = new RecoveryHashHarness();
    }

    function testDigestDeterministic() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _defaultScopes();
        RecoveryTypes.RecoveryIntent memory intent = _intent(_defaultPasskey(), scopes, DEADLINE);

        bytes32 d1 = harness.digest(address(0xBEEF), intent);
        bytes32 d2 = harness.digest(address(0xBEEF), intent);
        assertEq(d1, d2, "digest should be deterministic");
    }

    function testDigestChainIndependentForSameInputs() public {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _defaultScopes();
        RecoveryTypes.RecoveryIntent memory intent = _intent(_defaultPasskey(), scopes, DEADLINE);

        vm.chainId(1);
        bytes32 d1 = harness.digest(address(0xBEEF), intent);

        vm.chainId(8453);
        bytes32 d2 = harness.digest(address(0xBEEF), intent);

        assertEq(d1, d2, "portable digest must not depend on block.chainid");
    }

    function testSameScopesDifferentInputOrderProduceSameHashAfterNormalization() public view {
        RecoveryTypes.RecoveryModuleScope[] memory ordered = _defaultScopes();
        RecoveryTypes.RecoveryModuleScope[] memory reversed = _defaultScopesReversed();

        bytes32 orderedHash = harness.hashScopes(_normalizeTwo(reversed));
        bytes32 reversedHash = harness.hashScopes(_normalizeTwo(ordered));

        assertEq(orderedHash, reversedHash, "normalized scope hash should be stable");
    }

    function testDuplicateChainIdsAreRejected() public {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _defaultScopes();
        scopes[1].chainId = scopes[0].chainId;

        vm.expectRevert(
            abi.encodeWithSelector(
                RecoveryTypes.Recovery_UnsortedOrDuplicateChainScope.selector, scopes[0].chainId, scopes[1].chainId
            )
        );
        harness.hashScopes(scopes);
    }

    function testUnsortedChainIdsAreRejected() public {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _defaultScopesReversed();

        vm.expectRevert(
            abi.encodeWithSelector(
                RecoveryTypes.Recovery_UnsortedOrDuplicateChainScope.selector, scopes[0].chainId, scopes[1].chainId
            )
        );
        harness.hashScopes(scopes);
    }

    function testDifferentChainSetChangesHash() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopesA = _defaultScopes();
        RecoveryTypes.RecoveryModuleScope[] memory scopesB = new RecoveryTypes.RecoveryModuleScope[](1);
        scopesB[0] = scopesA[0];

        assertTrue(harness.hashScopes(scopesA) != harness.hashScopes(scopesB), "chain set must affect hash");
    }

    function testDifferentPerChainNonceChangesHash() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopesA = _defaultScopes();
        RecoveryTypes.RecoveryModuleScope[] memory scopesB = _defaultScopes();
        scopesB[1].nonce += 1;

        assertTrue(harness.hashScopes(scopesA) != harness.hashScopes(scopesB), "nonce must affect hash");
    }

    function testDifferentRecoveryModuleChangesHash() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopesA = _defaultScopes();
        RecoveryTypes.RecoveryModuleScope[] memory scopesB = _defaultScopes();
        scopesB[1].recoveryModule = MODULE_B;

        assertTrue(harness.hashScopes(scopesA) != harness.hashScopes(scopesB), "module must affect hash");
    }

    function testDifferentGuardianSetHashChangesHash() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopesA = _defaultScopes();
        RecoveryTypes.RecoveryModuleScope[] memory scopesB = _defaultScopes();
        scopesB[0].guardianSetHash = keccak256("guardian-set-b");

        assertTrue(harness.hashScopes(scopesA) != harness.hashScopes(scopesB), "guardian set must affect hash");
    }

    function testDifferentPolicyHashChangesHash() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopesA = _defaultScopes();
        RecoveryTypes.RecoveryModuleScope[] memory scopesB = _defaultScopes();
        scopesB[0].policyHash = keccak256("policy-b");

        assertTrue(harness.hashScopes(scopesA) != harness.hashScopes(scopesB), "policy must affect hash");
    }

    function testDifferentDeadlineChangesHash() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _defaultScopes();
        RecoveryTypes.RecoveryIntent memory intentA = _intent(_defaultPasskey(), scopes, DEADLINE);
        RecoveryTypes.RecoveryIntent memory intentB = _intent(_defaultPasskey(), scopes, DEADLINE + 1);

        assertTrue(harness.hashIntent(intentA) != harness.hashIntent(intentB), "deadline must affect hash");
    }

    function testDifferentNewPasskeyChangesHash() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _defaultScopes();
        RecoveryTypes.EmailRecoveryData memory dataA = _emailData(_defaultPasskey(), scopes, DEADLINE);
        RecoveryTypes.EmailRecoveryData memory dataB = _emailData(_alternatePasskey(), scopes, DEADLINE);

        assertTrue(
            harness.hashEmailRecoveryData(dataA) != harness.hashEmailRecoveryData(dataB), "passkey must affect hash"
        );
    }

    function testSolidityTypescriptVector() public view {
        RecoveryTypes.RecoveryModuleScope[] memory scopes = _defaultScopes();
        PasskeyTypes.PasskeyInit memory passkey = _defaultPasskey();
        RecoveryTypes.RecoveryIntent memory intent = _intent(passkey, scopes, DEADLINE);
        RecoveryTypes.EmailRecoveryData memory data = _emailData(passkey, scopes, DEADLINE);

        assertEq(harness.hashPasskey(passkey), 0x766309447cef0f160aae87a9b7292c02408cb3dac53bbf0d93e9b7da43faea93);
        assertEq(harness.hashScope(scopes[0]), 0x6ad573ffe3e26efc1bb913fd63b39b62666be00d43e8a00d1c05e3676116bc0d);
        assertEq(harness.hashScope(scopes[1]), 0xce5cf8d99ab5d61d878306f5789e5510e4a45631ce3cd1565cec260f512713e9);
        assertEq(harness.hashScopes(scopes), 0xba1a93104b3e5bae88315e9468d90eff2672d11424ab4b882d1a6a45ceb1aa7c);
        assertEq(harness.hashIntent(intent), 0x70f574b4653cce1de9f127410f2108886c60d68995ff00849b88932377f27f35);
        assertEq(
            harness.hashEmailRecoveryData(data), 0x8c4acab2e7c86e01f6f8bf2e06dd20cbce924fbb44cae8b43393860195344ce3
        );
    }

    function testLegacyScopeHashStillSupported() public view {
        RecoveryTypes.ChainRecoveryScope[] memory scopes = new RecoveryTypes.ChainRecoveryScope[](1);
        scopes[0] = RecoveryTypes.ChainRecoveryScope({
            chainId: 1,
            wallet: WALLET,
            socialRecovery: MODULE_A,
            nonce: 1,
            guardianSetHash: keccak256("legacy-guardians"),
            policyHash: keccak256("legacy-policy")
        });

        assertTrue(harness.hashLegacyScopes(scopes) != bytes32(0), "legacy hash helper must remain available");
    }

    function _defaultPasskey() internal pure returns (PasskeyTypes.PasskeyInit memory) {
        return PasskeyTypes.PasskeyInit({idRaw: bytes32(uint256(0x1234)), px: 11, py: 22});
    }

    function _alternatePasskey() internal pure returns (PasskeyTypes.PasskeyInit memory) {
        return PasskeyTypes.PasskeyInit({idRaw: bytes32(uint256(0x5678)), px: 33, py: 44});
    }

    function _defaultScopes() internal pure returns (RecoveryTypes.RecoveryModuleScope[] memory scopes) {
        scopes = new RecoveryTypes.RecoveryModuleScope[](2);
        scopes[0] = RecoveryTypes.RecoveryModuleScope({
            chainId: 8453,
            wallet: WALLET,
            recoveryModule: MODULE_A,
            nonce: 7,
            guardianSetHash: keccak256("guardian-set-base"),
            policyHash: keccak256("policy-base")
        });
        scopes[1] = RecoveryTypes.RecoveryModuleScope({
            chainId: 11_155_111,
            wallet: WALLET,
            recoveryModule: MODULE_A,
            nonce: 3,
            guardianSetHash: keccak256("guardian-set-sepolia"),
            policyHash: keccak256("policy-sepolia")
        });
    }

    function _defaultScopesReversed() internal pure returns (RecoveryTypes.RecoveryModuleScope[] memory scopes) {
        RecoveryTypes.RecoveryModuleScope[] memory ordered = _defaultScopes();
        scopes = new RecoveryTypes.RecoveryModuleScope[](2);
        scopes[0] = ordered[1];
        scopes[1] = ordered[0];
    }

    function _normalizeTwo(RecoveryTypes.RecoveryModuleScope[] memory scopes)
        internal
        pure
        returns (RecoveryTypes.RecoveryModuleScope[] memory normalized)
    {
        require(scopes.length == 2, "two scopes only");
        normalized = new RecoveryTypes.RecoveryModuleScope[](2);
        if (scopes[0].chainId < scopes[1].chainId) {
            normalized[0] = scopes[0];
            normalized[1] = scopes[1];
        } else {
            normalized[0] = scopes[1];
            normalized[1] = scopes[0];
        }
    }

    function _intent(
        PasskeyTypes.PasskeyInit memory passkey,
        RecoveryTypes.RecoveryModuleScope[] memory scopes,
        uint48 deadline
    ) internal pure returns (RecoveryTypes.RecoveryIntent memory) {
        return RecoveryTypes.RecoveryIntent({
            requestId: REQUEST_ID,
            newPasskeyHash: RecoveryHash.hashPasskeyInitMemory(passkey),
            chainScopeHash: RecoveryHash.hashChainScopesMemory(scopes),
            validAfter: 0,
            deadline: deadline,
            metadataHash: METADATA_HASH
        });
    }

    function _emailData(
        PasskeyTypes.PasskeyInit memory passkey,
        RecoveryTypes.RecoveryModuleScope[] memory scopes,
        uint48 deadline
    ) internal pure returns (RecoveryTypes.EmailRecoveryData memory) {
        return RecoveryTypes.EmailRecoveryData({
            version: 1, newPasskey: passkey, intent: _intent(passkey, scopes, deadline), scopes: scopes
        });
    }
}
