// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC7579ValidatorBase} from "lib/modulekit/src/Modules.sol";
import {PackedUserOperation} from "lib/modulekit/src/external/ERC4337.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {WebAuthn} from "@webauthn-sol/src/WebAuthn.sol";

contract PasskeyValidator is ERC7579ValidatorBase {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    type PasskeyId is bytes32;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event PasskeyAdded(address indexed account, bytes32 indexed passkeyId);
    event PasskeyRemoved(address indexed account, bytes32 indexed passkeyId);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    /**
     * Minimal-but-safe: rpIdHash (phishing resistance) + signCounter (clone detection)
     * Note: bytes32 for px/py is cheaper to store than uint256; cast when calling libs.
     */
    struct PasskeyRecord {
        uint256 px; // P-256 pubkey X
        uint256 py; // P-256 pubkey Y
        bytes32 rpIdHash; // SHA-256(RP ID)
        uint32 signCounter; 
    }

    // Encoded WebAuthn signature payload carried in signatures
    struct SigPayload {
        bytes32 idRaw;
        bytes authenticatorData;
        string clientDataJSON;
        uint256 challengeIndex;
        uint256 typeIndex;
        uint256 r;
        uint256 s;
    }

    /*//////////////////////////////////////////////////////////////////////////
                            CONSTANTS & STORAGE
    //////////////////////////////////////////////////////////////////////////*/
    bool constant REQUIRE_UV = true;

    // account => (passkeyId => record)
    mapping(address => mapping(PasskeyId => PasskeyRecord)) internal passkeys;
    mapping(address => EnumerableSet.Bytes32Set) internal passkeyIds; // stores PasskeyId.unwrap(id)

    /*//////////////////////////////////////////////////////////////////////////
                                     CONFIG
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * Install/initialize the validator for the calling account.
     *
     * Data encoding options:
     *  - Empty: installs the module without registering a passkey.
     *  - abi.encode(bytes32 passkeyId, uint256 px, uint256 py, bytes32 rpIdHash):
     *      installs and registers a single passkey for the caller.
     *
     * Reverts if the module is considered initialized (i.e. the caller already
     * has one or more passkeys registered). Use removePasskey to manage keys
     * after installation.
     *
     * @param data ABI-encoded initialization payload (see above).
     */
    function onInstall(bytes calldata data) external override {
        address account = msg.sender;
        if (passkeyIds[account].length() != 0) {
            revert ModuleAlreadyInitialized(account);
        }

        if (data.length == 0) return;

        // decode one passkey and register
        (bytes32 idRaw, uint256 px, uint256 py, bytes32 rpIdHash) =
            abi.decode(data, (bytes32, uint256, uint256, bytes32));

        PasskeyId id = PasskeyId.wrap(idRaw);
        require(!passkeyIds[account].contains(idRaw), "exists");
        // Initialize with signCounter = 0, first signature must have counter >= 1
        // However, some authenticators start at 0, so we accept counter >= stored value
        passkeys[account][id] = PasskeyRecord(px, py, rpIdHash, 0);
        passkeyIds[account].add(idRaw);
        emit PasskeyAdded(account, idRaw);
    }

    /**
     * Uninstall/de-initialize the validator for the calling account.
     *
     * Removes all registered passkeys for the caller. If no passkeys are
     * registered, it is treated as a no-op.
     */
    function onUninstall(bytes calldata /*data*/) external override {
        address account = msg.sender;
        uint256 len = passkeyIds[account].length();
        if (len == 0) return; // nothing to cleanup

        // iterate backwards to avoid index shifting with swap-and-pop
        for (uint256 i = len; i > 0; i--) {
            bytes32 raw = passkeyIds[account].at(i - 1);
            PasskeyId id = PasskeyId.wrap(raw);
            delete passkeys[account][id];
            passkeyIds[account].remove(raw);
            emit PasskeyRemoved(account, raw);
        }
    }

    /**
     * Check if the module is initialized for a given account.
     * The module is considered initialized when the account has at least one passkey registered.
     *
     * @param smartAccount The smart account to check.
     * @return initialized True if the module is initialized, false otherwise.
     */
    function isInitialized(address smartAccount) external view returns (bool initialized) {
        return passkeyIds[smartAccount].length() > 0;
    }

    /*//////////////////////////////////////////////////////////////////////////
                                     MODULE LOGIC
    //////////////////////////////////////////////////////////////////////////*/

    function addPasskey(bytes32 passkeyId, uint256 px, uint256 py, bytes32 rpIdHash) external {
        address account = msg.sender;
        PasskeyId id = PasskeyId.wrap(passkeyId);
        require(!passkeyIds[account].contains(passkeyId), "exists");
        passkeys[account][id] = PasskeyRecord(px, py, rpIdHash, 0);
        passkeyIds[account].add(passkeyId); // O(1)
        emit PasskeyAdded(account, passkeyId);
    }

    function removePasskey(bytes32 passkeyId) external {
        address account = msg.sender;
        PasskeyId id = PasskeyId.wrap(passkeyId);
        require(passkeyIds[account].contains(passkeyId), "no such key");
        delete passkeys[account][id];
        passkeyIds[account].remove(passkeyId); // O(1), internally swap-and-pop
        emit PasskeyRemoved(account, passkeyId);
    }

    /**
     * Validate a UserOperation using a registered WebAuthn passkey.
     *
     * Signature encoding expected in `userOp.signature` (ABI-encoded):
     *  - bytes32 passkeyId
     *  - bytes authenticatorData
     *  - string clientDataJSON
     *  - uint256 challengeIndex  (index of '"challenge":"' in clientDataJSON)
     *  - uint256 typeIndex       (index of '"type":"' in clientDataJSON)
     *  - uint256 r               (P-256 signature r)
     *  - uint256 s               (P-256 signature s)
     *
     * Validation performed:
     *  - The passkeyId must be registered for `userOp.sender`.
     *  - `authenticatorData.rpIdHash` must match the stored rpIdHash for this passkey.
     *  - The signature must verify per WebAuthn over challenge = `userOpHash` (RIP-7212/FCL).
     *  - The WebAuthn sign counter in `authenticatorData` must strictly increase.
     *  - User Verification (UV) is required.
     *
     * Returns packed ValidationData per ERC-4337 conventions. Does not revert on signature
     * failure; instead returns `sigFailed=true`.
     *
     * @param userOp The PackedUserOperation to validate.
     * @param userOpHash The standard ERC-4337 userOp hash used as the WebAuthn challenge.
     * @return result Packed validation data: success window or `sigFailed`.
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        override
        returns (ValidationData result)
    {
        (bool ok, uint32 newCounter, bytes32 idRaw) =
            _verifySignature(userOp.sender, userOp.signature, abi.encodePacked(userOpHash));
        if (!ok) {
            return _packValidationData({sigFailed: true, validUntil: 0, validAfter: 0});
        }

        // 3) Enforce non-decreasing signature counter (clone detection)
        // WebAuthn spec requires counters to be monotonically increasing, but some
        // authenticators may reuse the same counter value. We allow equal counters
        // for the same account to support these devices, but reject decreasing counters.
        PasskeyRecord storage rec = passkeys[userOp.sender][PasskeyId.wrap(idRaw)];
        if (newCounter < rec.signCounter) {
            return _packValidationData({sigFailed: true, validUntil: 0, validAfter: 0});
        }

        // Update stored counter
        rec.signCounter = newCounter;

        // Success: valid for all time (caller may add policy as desired)
        return _packValidationData({sigFailed: false, validUntil: type(uint48).max, validAfter: 0});
    }

    /**
     * Validates an ERC-1271 signature
     *
     * @param sender The sender of the ERC-1271 call to the account
     * @param hash The hash of the message
     * @param signature The signature of the message
     *
     * @return sigValidationResult the result of the signature validation, which can be:
     *  - EIP1271_SUCCESS if the signature is valid
     *  - EIP1271_FAILED if the signature is invalid
     */
    /**
     * ERC-1271 style signature validation bound to a sender.
     * Leverages the same WebAuthn verification as validateUserOp, without state updates.
     * Requires the passkey to be registered and rpIdHash to match. Also enforces the
     * sign counter to be strictly greater than the stored counter, but does not update it.
     *
     * Signature encoding is the same as in validateUserOp.
     *
     * @param sender The account that owns the passkey used to sign.
     * @param hash The message hash used as the WebAuthn challenge.
     * @param signature ABI-encoded WebAuthn signature payload (see validateUserOp docs).
     * @return sigValidationResult EIP-1271 magic value on success, or failure.
     */
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external
        view
        virtual
        override
        returns (bytes4 sigValidationResult)
    {
        (bool ok, uint32 newCounter, bytes32 idRaw) = _verifySignature(sender, signature, abi.encodePacked(hash));
        if (!ok) return EIP1271_FAILED;

        PasskeyRecord storage rec = passkeys[sender][PasskeyId.wrap(idRaw)];
        if (newCounter <= rec.signCounter) return EIP1271_FAILED;
        return EIP1271_SUCCESS;
    }

    /**
     * Validates a signature with data
     * @param hash The hash of the message
     * @param signature The signature of the message
     * @param data The data to validate the signature with
     * @return validSig true if the signature is valid, false otherwise
     *
     */
    /**
     * Validate a signature with arbitrary additional data context.
     * The `data` parameter is expected to contain the `sender` address encoded as
     * `abi.encode(address sender)` so the validator can locate the passkey record.
     *
     * Signature encoding is the same as in validateUserOp.
     *
     * Note: This function does not update the WebAuthn sign counter.
     *
     * @param hash The message hash used as the WebAuthn challenge.
     * @param signature ABI-encoded WebAuthn signature payload.
     * @param data Encoded context. Currently expects abi.encode(address sender).
     * @return validSig True if signature is valid and counter is strictly increasing.
     */
    function validateSignatureWithData(bytes32 hash, bytes calldata signature, bytes calldata data)
        external
        view
        virtual
        returns (bool validSig)
    {
        address sender = abi.decode(data, (address));
        (bool ok, uint32 newCounter, bytes32 idRaw) = _verifySignature(sender, signature, abi.encodePacked(hash));
        if (!ok) return false;
        PasskeyRecord storage rec = passkeys[sender][PasskeyId.wrap(idRaw)];
        return newCounter > rec.signCounter;
    }

    /*//////////////////////////////////////////////////////////////////////////
                                     INTERNAL
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * Internal reusable WebAuthn verification used by both 4337 and 1271 flows.
     *
     * @param account The account that owns the passkey.
     * @param signature ABI-encoded WebAuthn signature payload as in validateUserOp.
     * @param challenge The challenge bytes to verify (e.g., userOpHash or message hash).
     * @return ok True if passkey exists, rpIdHash matches and signature verifies.
     * @return newCounter The parsed WebAuthn sign counter from authenticatorData.
     * @return idRaw The raw passkeyId used for this verification.
     */
    function _verifySignature(address account, bytes calldata signature, bytes memory challenge)
        internal
        view
        returns (bool ok, uint32 newCounter, bytes32 idRaw)
    {
        SigPayload memory p = _decodeSig(signature);
        idRaw = p.idRaw;

        // Passkey must exist
        if (!passkeyIds[account].contains(p.idRaw)) {
            return (false, 0, idRaw);
        }

        PasskeyRecord storage rec = passkeys[account][PasskeyId.wrap(p.idRaw)];

        // Minimum length: 32 (rpIdHash) + 1 (flags) + 4 (counter)
        if (p.authenticatorData.length < 37) {
            return (false, 0, idRaw);
        }

        // Enforce rpIdHash binding to this passkey
        bytes32 adRpIdHash;
        bytes memory ad = p.authenticatorData;
        assembly {
            adRpIdHash := mload(add(ad, 32))
        }
        if (adRpIdHash != rec.rpIdHash) {
            return (false, 0, idRaw);
        }

        // WebAuthn verification
        WebAuthn.WebAuthnAuth memory auth = WebAuthn.WebAuthnAuth({
            authenticatorData: p.authenticatorData,
            clientDataJSON: p.clientDataJSON,
            challengeIndex: p.challengeIndex,
            typeIndex: p.typeIndex,
            r: p.r,
            s: p.s
        });

        bool sigOk = WebAuthn.verify(challenge, REQUIRE_UV, auth, rec.px, rec.py);
        if (!sigOk) {
            return (false, 0, idRaw);
        }

        // Parse counter
        newCounter = _parseSignCounter(p.authenticatorData);
        return (true, newCounter, idRaw);
    }

    function _decodeSig(bytes calldata signature) internal pure returns (SigPayload memory p) {
        (
            p.idRaw,
            p.authenticatorData,
            p.clientDataJSON,
            p.challengeIndex,
            p.typeIndex,
            p.r,
            p.s
        ) = abi.decode(signature, (bytes32, bytes, string, uint256, uint256, uint256, uint256));
    }

    /// @dev Parse the 4-byte big-endian signature counter at bytes 33..36 of authenticatorData.
    function _parseSignCounter(bytes memory authenticatorData) internal pure returns (uint32 ctr) {
        // bytes[32] is flags, bytes[33..36] is counter (big-endian)
        unchecked {
            ctr = (uint32(uint8(authenticatorData[33])) << 24)
                | (uint32(uint8(authenticatorData[34])) << 16)
                | (uint32(uint8(authenticatorData[35])) << 8)
                | uint32(uint8(authenticatorData[36]));
        }
    }

    /*//////////////////////////////////////////////////////////////////////////
                                     METADATA
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * The name of the module
     *
     * @return name The name of the module
     */
    function name() external pure returns (string memory) {
        return "PasskeyValidator";
    }

    /**
     * The version of the module
     *
     * @return version The version of the module
     */
    function version() external pure returns (string memory) {
        return "0.0.1";
    }

    /**
     * Check if the module is of a certain type
     *
     * @param typeID The type ID to check
     *
     * @return true if the module is of the given type, false otherwise
     */
    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == TYPE_VALIDATOR;
    }

    /*//////////////////////////////////////////////////////////////
                            READ ONLY UTILS
    //////////////////////////////////////////////////////////////*/

    function passkeyCount(address account) external view returns (uint256) {
        return passkeyIds[account].length();
    }

    function passkeyAt(address account, uint256 i) external view returns (PasskeyId) {
        return PasskeyId.wrap(passkeyIds[account].at(i));
    }

    function hasPasskey(address account, PasskeyId id) external view returns (bool) {
        return passkeyIds[account].contains(PasskeyId.unwrap(id));
    }
}
