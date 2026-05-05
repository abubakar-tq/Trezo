// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {WebAuthn} from "@webauthn-sol/src/WebAuthn.sol";
import {Base64} from "@webauthn-sol/lib/solady/src/utils/Base64.sol";
import {LibString} from "@webauthn-sol/lib/solady/src/utils/LibString.sol";

contract DebugWebAuthnTest is Test {
    using LibString for string;
    function test_webauthnVerify() public {
        // Actual passkey public key from the app logs
        uint256 px = 0x6c8d1e7d14d70c2d2d447ad1d37cd195dc63d10b9eef41faf485aa6a52b5782e;
        uint256 py = 0x72d5dad7d7add1f30f8dd4a89123dfe2c99a05a182cabbdc3a44e7d6a4be2b8c;
        
        // Actual signature data from the app logs
        bytes memory authenticatorData = hex"35f417fc136fa42053d2adb7ad6ba50aff12efb23d0a960835fd7e67dad93d081d00000000";
        string memory clientDataJSON = '{"type":"webauthn.get","challenge":"TbA0Wa8VKYrmZJG7DyvfKqNUNzTWUxAZk7iW4TYce0U","origin":"android:apk-key-hash:-sYXRdwJA3hvue3mKpYrOZ9zSPC7b4mbgzJmdZEDO5w","androidPackageName":"com.trezo.wallet"}';
        uint256 challengeIndex = 23;
        uint256 typeIndex = 1;
        uint256 r = 0x3e70b41f09475744549bc2c2096a16a185fa197281ef4beb5e5b8b7a453e4d20;
        uint256 s = 0x45b1a998d6ec397317989e398c47584170302aeab5294b6732c2930863a23f41;
        
        // Decode the actual userOpHash from the challenge
        // Challenge "TbA0Wa8VKYrmZJG7DyvfKqNUNzTWUxAZk7iW4TYce0U" base64url decodes to the userOpHash
        bytes memory challenge = abi.encodePacked(bytes32(0x4db03459af15298ae66491bb0f2bdf2aa3543734d653101993b896e1361c7b45));
        
        console2.log("Testing WebAuthn.verify()...");
        console2.log("Challenge index:", challengeIndex);
        console2.log("Type index:", typeIndex);
        console2.log("Client data length:", bytes(clientDataJSON).length);
        
        WebAuthn.WebAuthnAuth memory auth = WebAuthn.WebAuthnAuth({
            authenticatorData: authenticatorData,
            clientDataJSON: clientDataJSON,
            challengeIndex: challengeIndex,
            typeIndex: typeIndex,
            r: r,
            s: s
        });
        
        console2.log("Calling WebAuthn.verify()...");
        
        // Test with requireUV = false first
        console2.log("Testing with UV not required...");
        bool resultNoUV = WebAuthn.verify(challenge, false, auth, px, py);
        console2.log("Verification result (UV not required):", resultNoUV);
        
        // Test with requireUV = true
        console2.log("Testing with UV required...");
        bool result = WebAuthn.verify(challenge, true, auth, px, py);
        console2.log("Verification result (UV required):", result);
        
        // Log what we're checking
        console2.log("AuthenticatorData flags (byte 32):");
        console2.logBytes1(authenticatorData[32]);
        console2.log("Expected UP flag: 0x01, Expected UV flag: 0x04");
    }
}
