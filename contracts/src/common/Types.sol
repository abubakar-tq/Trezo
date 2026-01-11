// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library PasskeyTypes {
    struct PasskeyRecord {
        uint256 px;         // P-256 public key X
        uint256 py;         // P-256 public key Y
        bytes32 rpIdHash;   // 
        uint32  signCounter; // authenticator's signature counter at registration
    }

    struct PasskeyInit {
        bytes32 idRaw;      // credential ID (raw ID)
        uint256 px;         // P-256 public key X
        uint256 py;         // P-256 public key Y
        bytes32 rpIdHash;   // SHA-256(RP ID)
    }
}
