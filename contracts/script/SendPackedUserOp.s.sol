// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {DevOpsTools} from "lib/foundry-devops/src/DevOpsTools.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {WebAuthnHelper} from "src/utils/WebAuthnHelper.sol";
import {FCL_ecdsa_utils} from "lib/webauthn-sol/lib/FreshCryptoLib/solidity/src/FCL_ecdsa_utils.sol";
import {FCL_Elliptic_ZZ} from "lib/webauthn-sol/lib/FreshCryptoLib/solidity/src/FCL_elliptic.sol";

contract SendPackedUserOp is Script {
    /// @notice Helper bundle describing everything required to build a WebAuthn signature.
    struct PasskeySignatureData {
        PackedUserOperation userOp;
        bytes32 userOpHash;
        PasskeyTypes.PasskeyInit passkey;
        bytes authenticatorData;
        string clientDataJSON;
        uint256 challengeIndex;
        uint256 typeIndex;
        bytes32 messageHash;
    }

    uint256 private constant _P256_HALF_N = FCL_Elliptic_ZZ.n / 2;
    uint32 private constant _DEFAULT_SIGN_COUNTER = 1;
    bool private constant _DEFAULT_REQUIRE_UV = true;

    address constant RANDOM_APPROVER = 0x8943F7348E2559C6E69eeCb0dA932424C3E6dC66;

    /// @notice Sample broadcast showcasing an EOA-signed user operation.
    function run() public {
        HelperConfig helperConfig = new HelperConfig();
        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();

        address dest = config.usdc;
        address minimalAccountAddress = DevOpsTools.get_most_recent_deployment("SmartAccount", block.chainid);

        bytes memory functionData = abi.encodeWithSelector(IERC20.approve.selector, RANDOM_APPROVER, 1e18);
        bytes memory executeCalldata = abi.encodeWithSelector(SmartAccount.execute.selector, dest, 0, functionData);
        PackedUserOperation memory userOp =
            generateSignedUserOperation(executeCalldata, config, minimalAccountAddress);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.startBroadcast();
        IEntryPoint(config.entryPoint).handleOps(ops, payable(config.account));
        vm.stopBroadcast();
    }

    /// @notice Build and sign a PackedUserOperation using an EOA private key.
    /// @param callData Smart account calldata to execute.
    /// @param config Network configuration (entry point, default signer, etc.).
    /// @param smartAccount Smart account address issuing the user operation.
    /// @return userOp Packed user operation with an ECDSA signature.
    function generateSignedUserOperation(
        bytes memory callData,
        HelperConfig.NetworkConfig memory config,
        address smartAccount
    ) public view returns (PackedUserOperation memory) {
        // 1. Generate the unsigned data
        uint256 nonce = IEntryPoint(config.entryPoint).getNonce(smartAccount, 0);
        PackedUserOperation memory userOp = _generateUnsignedUserOperation(callData, smartAccount, nonce);

        // 2. Get the userOp Hash
        bytes32 digest = IEntryPoint(config.entryPoint).getUserOpHash(userOp);

        // 3. Sign it
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 ANVIL_DEFAULT_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        if (block.chainid == 31337) {
            (v, r, s) = vm.sign(ANVIL_DEFAULT_KEY, digest);
        } else {
            (v, r, s) = vm.sign(config.account, digest);
        }
        userOp.signature = abi.encodePacked(r, s, v);
        return userOp;
    }

    /// @notice Prepare a user operation and the associated WebAuthn payload for passkey signing.
    /// @dev Uses default options: sign counter = 1 and user verification required.
    function generatePasskeySignatureData(
        bytes memory callData,
        HelperConfig.NetworkConfig memory config,
        address smartAccount,
        uint256 passkeyIndex
    ) public view returns (PasskeySignatureData memory) {
        return generatePasskeySignatureData(
            callData,
            config,
            smartAccount,
            passkeyIndex,
            _DEFAULT_SIGN_COUNTER,
            _DEFAULT_REQUIRE_UV
        );
    }

    /// @notice Prepare a user operation and WebAuthn inputs for a passkey validator.
    /// @param callData Smart account calldata to execute.
    /// @param config Network configuration (entry point, default signer, etc.).
    /// @param smartAccount Smart account address issuing the user operation.
    /// @param passkeyIndex Index into PassKeyDemo fixtures.
    /// @param signCounter Incrementing authenticator sign counter.
    /// @param requireUserVerification Whether the UV flag must be set in authenticatorData.
    /// @return data Struct containing the unsigned userOp, hashes, and WebAuthn payload pieces.
    function generatePasskeySignatureData(
        bytes memory callData,
        HelperConfig.NetworkConfig memory config,
        address smartAccount,
        uint256 passkeyIndex,
        uint32 signCounter,
        bool requireUserVerification
    ) public view returns (PasskeySignatureData memory data) {
        uint256 nonce = IEntryPoint(config.entryPoint).getNonce(smartAccount, 0);
        data.userOp = _generateUnsignedUserOperation(callData, smartAccount, nonce);
        data.userOpHash = IEntryPoint(config.entryPoint).getUserOpHash(data.userOp);
        data.passkey = PassKeyDemo.getPasskeyInit(passkeyIndex);
        data.authenticatorData = WebAuthnHelper.buildAuthenticatorData(
            data.passkey.rpIdHash,
            requireUserVerification,
            signCounter
        );
        (data.clientDataJSON, data.challengeIndex, data.typeIndex) =
            WebAuthnHelper.buildClientDataJSONAndIndices(data.userOpHash);
        data.messageHash = WebAuthnHelper.webAuthnMessageHash(data.authenticatorData, data.clientDataJSON);
    }

    /// @notice Build and sign a passkey-based user operation (requires local private key).
    function generatePasskeySignedUserOperation(
        bytes memory callData,
        HelperConfig.NetworkConfig memory config,
        address smartAccount,
        uint256 passkeyIndex
    ) public view returns (PackedUserOperation memory) {
        return generatePasskeySignedUserOperation(
            callData,
            config,
            smartAccount,
            passkeyIndex,
            _DEFAULT_SIGN_COUNTER,
            _DEFAULT_REQUIRE_UV,
            PassKeyDemo.getPasskeyPrivateKey(passkeyIndex)
        );
    }

    /// @notice Build and sign a passkey-based user operation (requires local private key).
    /// @param callData Smart account calldata to execute.
    /// @param config Network configuration (entry point, default signer, etc.).
    /// @param smartAccount Smart account address issuing the user operation.
    /// @param passkeyIndex Index into PassKeyDemo fixtures.
    /// @param signCounter Incrementing authenticator sign counter.
    /// @param requireUserVerification Whether the UV flag must be set in authenticatorData.
    /// @return userOp Packed user operation containing a WebAuthn signature envelope.
    function generatePasskeySignedUserOperation(
        bytes memory callData,
        HelperConfig.NetworkConfig memory config,
        address smartAccount,
        uint256 passkeyIndex,
        uint32 signCounter,
        bool requireUserVerification
    ) public view returns (PackedUserOperation memory userOp) {
        return generatePasskeySignedUserOperation(
            callData,
            config,
            smartAccount,
            passkeyIndex,
            signCounter,
            requireUserVerification,
            PassKeyDemo.getPasskeyPrivateKey(passkeyIndex)
        );
    }

    /// @notice Build and sign a passkey-based user operation (requires explicit private key).
    function generatePasskeySignedUserOperation(
        bytes memory callData,
        HelperConfig.NetworkConfig memory config,
        address smartAccount,
        uint256 passkeyIndex,
        uint32 signCounter,
        bool requireUserVerification,
        bytes32 passkeyPrivateKey
    ) public view returns (PackedUserOperation memory userOp) {
        PasskeySignatureData memory data = generatePasskeySignatureData(
            callData,
            config,
            smartAccount,
            passkeyIndex,
            signCounter,
            requireUserVerification
        );

        uint256 privKey = uint256(passkeyPrivateKey);
        require(privKey != 0, "Passkey private key missing");

        (uint256 r, uint256 s) = _signPasskeyDigest(data.messageHash, privKey);
        data.userOp.signature = WebAuthnHelper.encodePasskeySignature(
            data.passkey.idRaw,
            data.authenticatorData,
            data.clientDataJSON,
            data.challengeIndex,
            data.typeIndex,
            r,
            s
        );
        return data.userOp;
    }

    /// @notice Assemble an unsigned user operation with standard gas defaults.
    /// @param callData Smart account calldata to execute.
    /// @param sender Smart account address issuing the user operation.
    /// @param nonce Nonce sourced from the entry point.
    /// @return Packed user operation without signature.
    function _generateUnsignedUserOperation(bytes memory callData, address sender, uint256 nonce)
        public
        pure
        returns (PackedUserOperation memory)
    {
        uint128 verificationGasLimit = 16777216;
        uint128 callGasLimit = verificationGasLimit;
        uint128 maxPriorityFeePerGas = 256;
        uint128 maxFeePerGas = maxPriorityFeePerGas;
        return PackedUserOperation({
            sender: sender,
            nonce: nonce,
            initCode: hex"",
            callData: callData,
            accountGasLimits: bytes32(uint256(verificationGasLimit) << 128 | callGasLimit),
            preVerificationGas: verificationGasLimit,
            gasFees: bytes32(uint256(maxPriorityFeePerGas) << 128 | maxFeePerGas),
            paymasterAndData: hex"",
            signature: hex""
        });
    }

    function _signPasskeyDigest(bytes32 digest, uint256 privKey) internal view returns (uint256 r, uint256 s) {
        uint256 nonce = _deriveDeterministicNonce(digest, privKey);
        (r, s) = FCL_ecdsa_utils.ecdsa_sign(digest, nonce, privKey);
        if (s > _P256_HALF_N) {
            s = FCL_Elliptic_ZZ.n - s;
        }
    }

    function _deriveDeterministicNonce(bytes32 digest, uint256 privKey) internal pure returns (uint256 nonce) {
        nonce = uint256(keccak256(abi.encodePacked("trezo-passkey-nonce", digest, privKey)));
        nonce = _normalizeNonce(nonce);
    }

    function _normalizeNonce(uint256 nonce) internal pure returns (uint256) {
        return nonce % (FCL_Elliptic_ZZ.n - 1) + 1;
    }
}
