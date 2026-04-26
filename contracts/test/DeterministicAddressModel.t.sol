// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {HelperConfig} from "script/HelperConfig.s.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {AccountFactoryTestHelper} from "test/helpers/AccountFactoryTestHelper.sol";

contract DeterministicAddressModelTest is AccountFactoryTestHelper {
    AccountFactory internal accountFactory;
    MinimalProxyFactory internal proxyFactory;
    PasskeyValidator internal validator;
    HelperConfig internal helperConfig;

    bytes32 internal constant WALLET_ID = keccak256("trezo-wallet-id");
    uint256 internal constant WALLET_INDEX = 0;

    function setUp() public {
        (helperConfig,, proxyFactory, accountFactory, validator,) = _deployAccountStack();
    }

    function testSameSnapshotKeepsPortablePredictionStable() public view {
        PasskeyTypes.PasskeyInit memory passkey = PassKeyDemo.getPasskeyInit(0);

        address predictedBefore = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), passkey);
        address predictedAfter = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), passkey);

        assertEq(predictedAfter, predictedBefore, "same snapshot should keep prediction stable");
    }

    function testPortableAddressChangesWhenPasskeyChanges() public view {
        PasskeyTypes.PasskeyInit memory passkeyA = PassKeyDemo.getPasskeyInit(0);
        PasskeyTypes.PasskeyInit memory passkeyB = PassKeyDemo.getPasskeyInit(1);

        address predictedA = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), passkeyA);
        address predictedB = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), passkeyB);

        assertTrue(predictedA != predictedB, "portable address should change with passkey snapshot");
    }

    function testPortableAddressChangesWhenValidatorChanges() public {
        PasskeyTypes.PasskeyInit memory passkey = PassKeyDemo.getPasskeyInit(0);
        PasskeyValidator alternateValidator = new PasskeyValidator();

        address predictedA = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), passkey);
        address predictedB = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(alternateValidator), passkey);

        assertTrue(predictedA != predictedB, "portable address should change with validator snapshot");
    }

    function testPortableAddressChangesWithWalletIdentity() public view {
        PasskeyTypes.PasskeyInit memory passkey = PassKeyDemo.getPasskeyInit(0);

        address walletA = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), passkey);
        address walletB = accountFactory.predictAccount(keccak256("other-wallet-id"), WALLET_INDEX, address(validator), passkey);
        address walletC = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX + 1, address(validator), passkey);

        assertTrue(walletA != walletB, "walletId should affect address");
        assertTrue(walletA != walletC, "walletIndex should affect address");
    }

    function testChainSpecificAddressChangesWithChainId() public {
        PasskeyTypes.PasskeyInit memory passkey = PassKeyDemo.getPasskeyInit(0);
        bytes32 walletId = keccak256("chain-specific-wallet");
        uint256 originalChainId = block.chainid;

        address originalPrediction =
            accountFactory.predictChainSpecificAccount(walletId, WALLET_INDEX, address(validator), passkey);

        vm.chainId(originalChainId + 1);
        address changedPrediction =
            accountFactory.predictChainSpecificAccount(walletId, WALLET_INDEX, address(validator), passkey);

        assertTrue(originalPrediction != changedPrediction, "chain-specific mode should bind chainId");
    }

    function testCreateAccountDeploysWithoutOffchainAuthorization() public {
        PasskeyTypes.PasskeyInit memory passkey = PassKeyDemo.getPasskeyInit(0);

        address predicted = accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), passkey);
        address deployed = _createAccount(accountFactory, WALLET_ID, WALLET_INDEX, address(validator), passkey);

        assertEq(deployed, predicted, "deployed address should match prediction");
    }

    function testCreateAccountInstallsProvidedPasskey() public {
        PasskeyTypes.PasskeyInit memory passkey = PassKeyDemo.getPasskeyInit(0);

        address deployed = _createAccount(accountFactory, WALLET_ID, WALLET_INDEX, address(validator), passkey);

        assertTrue(
            validator.hasPasskey(deployed, PasskeyValidator.PasskeyId.wrap(passkey.idRaw)),
            "provided passkey should be installed"
        );
    }

    function testNonAccountFactoryCannotCreateProxy() public {
        vm.expectRevert();
        proxyFactory.createProxy("", keccak256("unauthorized"));
    }

    function testReplayingOriginalSnapshotReproducesPortableAddress() public {
        PasskeyTypes.PasskeyInit memory originalPasskey = PassKeyDemo.getPasskeyInit(0);
        PasskeyTypes.PasskeyInit memory currentPasskey = PassKeyDemo.getPasskeyInit(1);

        address originalPrediction =
            accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), originalPasskey);
        address currentPrediction =
            accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), currentPasskey);
        address replayedPrediction =
            accountFactory.predictAccount(WALLET_ID, WALLET_INDEX, address(validator), originalPasskey);

        assertTrue(originalPrediction != currentPrediction, "current snapshot should move address");
        assertEq(replayedPrediction, originalPrediction, "replaying original snapshot should reproduce address");
    }
}
