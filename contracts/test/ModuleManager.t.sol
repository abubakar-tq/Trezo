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
import {WebAuthnHelper} from "src/utils/WebAuthnHelper.sol";
import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";

import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {PassKeyDemo} from "src/utils/PasskeyCred.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract ModuleManagerTest is Test {
    SmartAccount internal account;

    MinimalProxyFactory factory;
    address proxy;
    AccountFactory accountFactory;
    HelperConfig helperConfig;

    PasskeyValidator internal validator;

    address internal owner = address(this);
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant PASSKEY1_PRIV_KEY =
        0xe869435ccce456e66779f607cad397fd79c6f3bb82d846b121121b128c569715;

    bytes32 internal dummyId;
    uint256 internal px;
    uint256 internal py;

    SendPackedUserOp internal sendUserOp;
    DeployAccount deployScript;

    address entryPoint;

    function setUp() public {
        deployScript = new DeployAccount();

        (helperConfig, account, factory, accountFactory, validator,) = deployScript.deployAccount();

        proxy = accountFactory.createAccount(
            keccak256("module-manager-test"), address(validator), PassKeyDemo.getPasskeyInit(0)
        );

        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        entryPoint = config.entryPoint;
        sendUserOp = new SendPackedUserOp();
        dummyId = 0xb976cb58a15d247afc49d3015e7a45b962532a388c5c2d6225ef7ba3bd494b7d;
    }

    function testInstallPasskey() public {
        

        bytes memory functionData = abi.encodeWithSelector(
            SmartAccount.installModule.selector,
            MODULE_TYPE_VALIDATOR,
            address(validator),
            PassKeyDemo.getPasskeyInit(1)
        );
        bytes memory executeCalldata =
            abi.encodeWithSelector(SmartAccount.execute.selector, proxy, 0, functionData);

        HelperConfig.NetworkConfig memory config = helperConfig.getConfig();
        SendPackedUserOp.PasskeySignatureData memory passkeyData = sendUserOp.generatePasskeySignatureData(
            executeCalldata,
            config,
            proxy,
            0
        );

        console2.log("Passkey msgHash (reference)");
        console2.logBytes32(passkeyData.messageHash);

        PackedUserOperation memory signedUserOp = sendUserOp.generatePasskeySignedUserOperation(
            executeCalldata,
            config,
            proxy,
            0,
            1,
            true,
            PassKeyDemo.getPasskeyPrivateKey(0)
        );

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = signedUserOp;


        vm.deal(payable(proxy), 2 ether);
        vm.deal(address(stranger), 2 ether);

        vm.startPrank(stranger);
        IEntryPoint(entryPoint).handleOps(ops, payable(stranger));
        vm.stopPrank();
    }

    function testInstallValidatorAndValidateUserOp() public {

        testInstallPasskey();

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

        // bytes memory ad = WebAuthnHelper.buildAuthenticatorData(<rpHash>, true, 1);
        // (string memory cjson, uint256 cIdx, uint256 tIdx) = WebAuthnHelper.buildClientDataJSONAndIndices(digest);
        // bytes32 msgHash = WebAuthnHelper.webAuthnMessageHash(ad, cjson);
        // console2.log("Passkey msgHash (sign off-chain and paste r,s)");
        // console2.logBytes32(msgHash);

        // uint256 r = 0x011c9b597a9d140fbb97ed9aa2e2f0239115352e25c5bdcbda9460e61130c172;
        // uint256 s = 0x7030fa31d9589781eb906106c7e62241235d3d3508bb9731b64a9799219c6383;
        // if (r == 0 || s == 0) {
        //     console2.log("Skipping execution: provide non-zero r,s to run");
        //     return;
        // }

        // bytes memory sig = WebAuthnHelper.encodePasskeySignature(dummyId, ad, cjson, cIdx, tIdx, r, s);
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
