// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library RecoveryTypes {
    struct ChainRecoveryScope {
        uint256 chainId;
        address wallet;
        address socialRecovery;
        uint256 nonce;
        bytes32 guardianSetHash;
        bytes32 policyHash;
    }

    struct RecoveryIntent {
        bytes32 requestId;
        bytes32 newPasskeyHash;
        bytes32 chainScopeHash;
        uint48 validAfter;
        uint48 deadline;
        bytes32 metadataHash;
    }

    struct RecoveryPolicy {
        uint256 threshold;
        uint256 timelockSeconds;
    }

    bytes32 internal constant PASSKEY_INIT_TYPEHASH =
        keccak256("PasskeyInit(bytes32 idRaw,uint256 px,uint256 py)");
    bytes32 internal constant CHAIN_RECOVERY_SCOPE_TYPEHASH = keccak256(
        "ChainRecoveryScope(uint256 chainId,address wallet,address socialRecovery,uint256 nonce,bytes32 guardianSetHash,bytes32 policyHash)"
    );
    bytes32 internal constant RECOVERY_INTENT_TYPEHASH = keccak256(
        "RecoveryIntent(bytes32 requestId,bytes32 newPasskeyHash,bytes32 chainScopeHash,uint48 validAfter,uint48 deadline,bytes32 metadataHash)"
    );
    bytes32 internal constant PORTABLE_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,address verifyingContract)");
    bytes32 internal constant PORTABLE_NAME_HASH = keccak256("Trezo Social Recovery");
    bytes32 internal constant PORTABLE_VERSION_HASH = keccak256("1");

    error SocialRecovery_DeadlineExpired(uint48 deadline);
    error SocialRecovery_NotYetValid(uint48 validAfter);
    error SocialRecovery_PasskeyHashMismatch();
    error SocialRecovery_ScopeHashMismatch();
    error SocialRecovery_ChainNotInScope(uint256 chainId);
    error SocialRecovery_ScopeWalletMismatch(address expected, address provided);
    error SocialRecovery_ScopeModuleMismatch(address expected, address provided);
    error SocialRecovery_ScopeNonceMismatch(uint256 expected, uint256 provided);
    error SocialRecovery_GuardianSetChanged();
    error SocialRecovery_PolicyChanged();
}
