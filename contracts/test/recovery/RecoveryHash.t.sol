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

    function hashScopes(RecoveryTypes.ChainRecoveryScope[] calldata scopes) external pure returns (bytes32) {
        return RecoveryHash.hashChainScopes(scopes);
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

    function setUp() public {
        harness = new RecoveryHashHarness();
    }

    function testDigestDeterministic() public view {
        RecoveryTypes.RecoveryIntent memory intent = RecoveryTypes.RecoveryIntent({
            requestId: keccak256("req"),
            newPasskeyHash: keccak256("passkey"),
            chainScopeHash: keccak256("scope"),
            validAfter: 0,
            deadline: uint48(block.timestamp + 1 days),
            metadataHash: keccak256("meta")
        });

        bytes32 d1 = harness.digest(address(0xBEEF), intent);
        bytes32 d2 = harness.digest(address(0xBEEF), intent);
        assertEq(d1, d2, "digest should be deterministic");
    }

    function testDigestChainIndependentForSameInputs() public {
        RecoveryTypes.RecoveryIntent memory intent = RecoveryTypes.RecoveryIntent({
            requestId: keccak256("req"),
            newPasskeyHash: keccak256("passkey"),
            chainScopeHash: keccak256("scope"),
            validAfter: 0,
            deadline: uint48(block.timestamp + 1 days),
            metadataHash: keccak256("meta")
        });

        vm.chainId(1);
        bytes32 d1 = harness.digest(address(0xBEEF), intent);

        vm.chainId(8453);
        bytes32 d2 = harness.digest(address(0xBEEF), intent);

        assertEq(d1, d2, "portable digest must not depend on block.chainid");
    }

    function testScopeHashChangesWhenScopeChanges() public view {
        RecoveryTypes.ChainRecoveryScope[] memory scopesA = new RecoveryTypes.ChainRecoveryScope[](1);
        scopesA[0] = RecoveryTypes.ChainRecoveryScope({
            chainId: 1,
            wallet: address(0x1234),
            socialRecovery: address(0x9999),
            nonce: 1,
            guardianSetHash: keccak256("guardians-a"),
            policyHash: keccak256("policy-a")
        });

        RecoveryTypes.ChainRecoveryScope[] memory scopesB = new RecoveryTypes.ChainRecoveryScope[](1);
        scopesB[0] = RecoveryTypes.ChainRecoveryScope({
            chainId: 1,
            wallet: address(0x1234),
            socialRecovery: address(0x9999),
            nonce: 2,
            guardianSetHash: keccak256("guardians-a"),
            policyHash: keccak256("policy-a")
        });

        bytes32 a = harness.hashScopes(scopesA);
        bytes32 b = harness.hashScopes(scopesB);

        assertTrue(a != b, "scope hash must change when any scope field changes");
    }

    function testPasskeyHashChangesWhenPasskeyChanges() public view {
        PasskeyTypes.PasskeyInit memory p1 = PasskeyTypes.PasskeyInit({
            idRaw: bytes32(uint256(1)),
            px: 11,
            py: 22
        });

        PasskeyTypes.PasskeyInit memory p2 = PasskeyTypes.PasskeyInit({
            idRaw: bytes32(uint256(2)),
            px: 11,
            py: 22
        });

        bytes32 h1 = harness.hashPasskey(p1);
        bytes32 h2 = harness.hashPasskey(p2);

        assertTrue(h1 != h2, "passkey hash must change when passkey changes");
    }
}
