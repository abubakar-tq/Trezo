// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library DeployConstants {
    address internal constant SAFE_SINGLETON_FACTORY = 0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7;
    address internal constant ENTRYPOINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    string internal constant TREZO_INFRA_VERSION = "TREZO_INFRA_V2";

    bytes32 internal constant SMART_ACCOUNT_IMPL_SALT = keccak256("TREZO_SMART_ACCOUNT_IMPL_V2");
    bytes32 internal constant PASSKEY_VALIDATOR_SALT = keccak256("TREZO_PASSKEY_VALIDATOR_V2");
    bytes32 internal constant SOCIAL_RECOVERY_SALT = keccak256("TREZO_SOCIAL_RECOVERY_V2");
    bytes32 internal constant MINIMAL_PROXY_FACTORY_SALT = keccak256("TREZO_MINIMAL_PROXY_FACTORY_V2");
    bytes32 internal constant ACCOUNT_FACTORY_SALT = keccak256("TREZO_ACCOUNT_FACTORY_V2");

    function isPortableChain(uint256 chainId) internal pure returns (bool) {
        return chainId == 1 || chainId == 11_155_111 || chainId == 10 || chainId == 8453
            || chainId == 42_161 || chainId == 137;
    }

    function isNonPortableChain(uint256 chainId) internal pure returns (bool) {
        return chainId == 300 || chainId == 324;
    }
}
