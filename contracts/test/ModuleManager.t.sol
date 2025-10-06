// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console2} from "forge-std/Test.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_EXECUTOR,
    MODULE_TYPE_FALLBACK,
    MODULE_TYPE_HOOK,
    VALIDATION_SUCCESS
} from "@ERC7579/src/interfaces/IERC7579Module.sol";
import {ModeLib, ModeCode, CallType, CALLTYPE_SINGLE} from "@ERC7579/src/lib/ModeLib.sol";
import {ExecutionLib} from "@ERC7579/src/lib/ExecutionLib.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {MockTarget} from "test/mocks/ModuleMocks.sol";
import {WebAuthnTestUtils} from "test/modules/utils/WebAuthnTestUtils.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";

import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {PassKeyDemo} from "test/utils/PasskeyCred.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract ModuleManagerTest is Test {
    SmartAccount internal account;

    MinimalProxyFactory factory;
    address proxy;
    AccountFactory accountFactory;
    HelperConfig helperConfig;

    PasskeyValidator internal validator;
    MockTarget internal target;

    address internal owner = address(this);
    address internal stranger = makeAddr("stranger");

    bytes32 internal dummyId;
    bytes32 internal rpIdHash;

    uint256 internal px;
    uint256 internal py;

    SendPackedUserOp internal sendUserOp;
    DeployAccount deployScript;

    address entryPoint;

    function setUp() public {
        deployScript = new DeployAccount();

        (helperConfig, account, factory, accountFactory, validator) = deployScript.deployAccount();

        proxy = accountFactory.createAccount(
            keccak256("module-manager-test"), address(validator), PassKeyDemo.getPasskeyInit(0)
        );

        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        entryPoint = config.entryPoint;
        sendUserOp = new SendPackedUserOp();
        rpIdHash = 0x638841ea13dd17405349cb4795e780a1105648d79c51e6671af0a66d7597f945;
        dummyId = 0xb976cb58a15d247afc49d3015e7a45b962532a388c5c2d6225ef7ba3bd494b7d;
    }

    function installPasskey() internal {
        //Todo: Create PackedUser operation to install the passkey validator which is being signed  in next lines, create a function to create user ops first then use it here

        bytes memory functionData = abi.encodeWithSelector(
            SmartAccount.installModule.selector,
            MODULE_TYPE_VALIDATOR,
            address(validator),
            PassKeyDemo.getPasskeyInit(1)
        );
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount.execute.selector, proxy, 0, functionData);

        PackedUserOperation memory userOpData = sendUserOp._generateUnsignedUserOperation(
            executeCalldata, proxy, IEntryPoint(entryPoint).getNonce(proxy, 0)
        );

        bytes32 digest = IEntryPoint(entryPoint).getUserOpHash(userOpData);

        bytes memory ad = WebAuthnTestUtils.buildAuthenticatorData(rpIdHash, true, 1);
        (string memory cjson, uint256 cIdx, uint256 tIdx) = WebAuthnTestUtils.buildClientDataJSONAndIndices(digest);
        bytes32 msgHash = WebAuthnTestUtils.webAuthnMessageHash(ad, cjson);
        console2.log("Passkey msgHash (sign off-chain and paste r,s)");
        console2.logBytes32(msgHash);

        uint256 r = 0xb164fbf91459949fd4402e4a6e9db9725783617f553393e754a4af78a2f7cc0a;
        uint256 s = 0x75c83e6eca6c7ed3d263fcef1440e2ec1cd22edf54d437b6230ddd9d1bd235e1;
        if (r == 0 || s == 0) {
            console2.log("Skipping execution: provide non-zero r,s to run");
            return;
        }

        bytes memory sig = WebAuthnTestUtils.encodePasskeySignature(dummyId, ad, cjson, cIdx, tIdx, r, s);
        userOpData.signature = sig;

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOpData;

        console2.log("Proxy EntryPoint: ", SmartAccount(payable(proxy)).getEntryPoint());
        console2.log("Config EntryPoint: ", entryPoint);


        vm.deal(payable(proxy), 2 ether);
        vm.deal(address(stranger), 2 ether);

        vm.startPrank(stranger);
        IEntryPoint(entryPoint).handleOps(ops, payable(stranger));
        vm.stopPrank();
    }

    function testInstallValidatorAndValidateUserOp() public {
        installPasskey();

        // Validate that the validator module is installed
        address module = SmartAccount(payable(proxy)).activeValidator();
        assert(module == address(validator));

        // // Prepare a user operation that requires validation
        // bytes memory functionData = abi.encodeWithSelector(IERC20.approve.selector, makeAddr("random-approver"), 1e18);
        // bytes memory executeCalldata =
        //     abi.encodeWithSelector(SmartAccount.execute.selector, makeAddr("random-dest"), 0, functionData);

        // PackedUserOperation memory userOp =
        //     sendUserOp._generateUnsignedUserOperation(executeCalldata, address(account), 2);

        // bytes32 digest = IEntryPoint(helperConfig.getConfig().entryPoint).getUserOpHash(userOp);

        // bytes memory ad = WebAuthnTestUtils.buildAuthenticatorData(rpIdHash, true, 1);
        // (string memory cjson, uint256 cIdx, uint256 tIdx) = WebAuthnTestUtils.buildClientDataJSONAndIndices(digest);
        // bytes32 msgHash = WebAuthnTestUtils.webAuthnMessageHash(ad, cjson);
        // console2.log("Passkey msgHash (sign off-chain and paste r,s)");
        // console2.logBytes32(msgHash);

        // uint256 r = 0x011c9b597a9d140fbb97ed9aa2e2f0239115352e25c5bdcbda9460e61130c172;
        // uint256 s = 0x7030fa31d9589781eb906106c7e62241235d3d3508bb9731b64a9799219c6383;
        // if (r == 0 || s == 0) {
        //     console2.log("Skipping execution: provide non-zero r,s to run");
        //     return;
        // }

        // bytes memory sig = WebAuthnTestUtils.encodePasskeySignature(dummyId, ad, cjson, cIdx, tIdx, r, s);
        // userOp.signature = sig;
        // PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        // ops[0] = userOp;
        // vm.deal(payable(address(account)), 2 ether);
        // IEntryPoint(helperConfig.getConfig().entryPoint).handleOps(ops, payable(helperConfig.getConfig().account));
        // console2.log("User operation validated and executed via PasskeyValidator module");
    }

    // function testOnlyOwnerCanInstallModule() public {
    //     vm.startPrank(stranger);
    //     vm.expectRevert(SmartAccount.NotOwner.selector);
    //     account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");
    //     vm.stopPrank();
    // }
}
