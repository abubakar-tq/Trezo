// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.30;

// import {Test,console2} from "forge-std/Test.sol";
// import {SmartAccount} from "src/account/SmartAccount.sol";
// import {PackedUserOperation} from "@ERC4337/account-abstraction/contracts/core/UserOperationLib.sol";
// import {
//     MODULE_TYPE_VALIDATOR,
//     MODULE_TYPE_EXECUTOR,
//     MODULE_TYPE_FALLBACK,
//     MODULE_TYPE_HOOK,
//     VALIDATION_SUCCESS
// } from "@ERC7579/src/interfaces/IERC7579Module.sol";
// import {ModeLib, ModeCode, CallType, CALLTYPE_SINGLE} from "@ERC7579/src/lib/ModeLib.sol";
// import {ExecutionLib} from "@ERC7579/src/lib/ExecutionLib.sol";
// import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
// import {MockTarget} from "test/mocks/ModuleMocks.sol";
// import {WebAuthnTestUtils} from "test/modules/utils/WebAuthnTestUtils.sol";
// import {SendPackedUserOp} from "script/SendPackedUserOp.s.sol";


// contract ModuleManagerTest is Test {
//     SmartAccount internal account;
//     PasskeyValidator internal validator;
//     MockTarget internal target;

//     address internal owner = address(this);
//     address internal entryPoint = makeAddr("entryPoint");
//     address internal stranger = makeAddr("stranger");

//     bytes32 internal dummyId;
//     bytes32 internal rpIdHash;

//     uint256 internal px;
//     uint256 internal py;

//     SendPackedUserOp internal sendUserOp;


//     function setUp() public {
//         account = new SmartAccount();

//         account.initialize(entryPoint);

//         validator = new PasskeyValidator();
//         target = new MockTarget();

//          // Install PasskeyValidator with a passkey
//         // Data encoding expected by onInstall:
//         // abi.encode(bytes32 idRaw, uint256 px, uint256 py, bytes32 rpIdHash)
//         dummyId = 0xb976cb58a15d247afc49d3015e7a45b962532a388c5c2d6225ef7ba3bd494b7d;
//         px = uint256(0xc92b6c998c854fcb69cff745bbc83c69cd3e1f3b2904f2cfd7e5a9119ee8eb38);
//         py = uint256(0xd64d667544491335c127c62471c5bbca05d1a3aa9641989f964f7cd26504a45d);
//         rpIdHash = 0x638841ea13dd17405349cb4795e780a1105648d79c51e6671af0a66d7597f945;

//         sendUserOp = new SendPackedUserOp();


//         installModule({
//             moduleTypeId: MODULE_TYPE_VALIDATOR,
//             module: address(validator),
//             data: abi.encode(dummyId, px, py, rpIdHash)
//         });
//     }

//     function installPasskey() internal {
//         //Todo: Create PackedUser operation to install the passkey validator which is being signed  in next lines, create a function to create user ops first then use it here

//         bytes memory functionData = abi.encodeWithSelector(account.installModule.selector, MODULE_TYPE_VALIDATOR, address(validator), "");
//         bytes memory executeCalldata = abi.encodeWithSelector(SmartAccount.execute.selector, address(account), 0, functionData);

//         sendUserOp._generateUnsignedUserOperation(executeCalldata, address(account), 0);
     

//         account.setDefaultValidator(address(validator));

//         bytes memory ad = WebAuthnTestUtils.buildAuthenticatorData(rpIdHash, true, 1);
//         (string memory cjson, uint256 cIdx, uint256 tIdx) =
//             WebAuthnTestUtils.buildClientDataJSONAndIndices(userOpData.userOpHash);
//         bytes32 msgHash = WebAuthnTestUtils.webAuthnMessageHash(ad, cjson);
//         console2.log("Passkey msgHash (sign off-chain and paste r,s)");
//         console2.logBytes32(msgHash);

//         uint256 r = 0x011c9b597a9d140fbb97ed9aa2e2f0239115352e25c5bdcbda9460e61130c172;
//         uint256 s = 0x7030fa31d9589781eb906106c7e62241235d3d3508bb9731b64a9799219c6383;
//         if (r == 0 || s == 0) {
//             console2.log("Skipping execution: provide non-zero r,s to run");
//             return;
//         }

//         bytes memory sig = WebAuthnTestUtils.encodePasskeySignature(dummyId, ad, cjson, cIdx, tIdx, r, s);
//         userOpData.userOp.signature = sig;

//         PackedUserOperation[] memory ops = new PackedUserOperation[](1);
//         ops[0] = userOp;

//     }

//     function testInstallValidatorAndValidateUserOp() public {
//         account.installModule(MODULE_TYPE_VALIDATOR, address(validator), "");
//         account.setDefaultValidator(address(validator));

//         PackedUserOperation memory op;
//         op.sender = address(account);

//         bytes32 userOpHash = keccak256("validate-op");

//         vm.prank(entryPoint);
//         uint256 result = account.validateUserOp(op, userOpHash, 0);

//         assertEq(result, VALIDATION_SUCCESS, "validator should signal success");
//         assertEq(validator.validationCount(), 1, "validator called once");
//         assertEq(validator.lastSender(), address(account), "smart account called validator");

//         address[] memory validators = account.listModules(MODULE_TYPE_VALIDATOR);
//         assertEq(validators.length, 1);
//         assertEq(validators[0], address(validator));
//     }

//     function testExecuteRunsHooks() public {
//         account.installModule(MODULE_TYPE_HOOK, address(hook), "");

//         bytes memory callData = abi.encodeWithSelector(MockTarget.increment.selector);
//         bytes memory executionCalldata = ExecutionLib.encodeSingle(address(target), 0, callData);
//         account.execute(ModeLib.encodeSimpleSingle(), executionCalldata);

//         assertEq(target.counter(), 1, "target incremented");
//         assertEq(hook.preCallCount(), 1, "pre hook called");
//         assertEq(hook.postCallCount(), 1, "post hook called");
//         assertEq(hook.lastSender(), owner, "hook sees owner sender");
//         assertEq(hook.lastValue(), 0, "value propagated");

//         bytes memory payload = hook.lastData();
//         (uint8 phaseRaw, address hookSender, ModeCode mode, bytes1 callTypeRaw, bytes memory reported)
//             = abi.decode(payload, (uint8, address, ModeCode, bytes1, bytes));
//         assertEq(phaseRaw, uint8(SmartAccount.HookPhase.Execution), "hook phase");
//         assertEq(hookSender, owner, "hook sender matches");
//         assertEq(ModeCode.unwrap(mode), ModeCode.unwrap(ModeLib.encodeSimpleSingle()), "mode propagates");
//         assertEq(uint8(callTypeRaw), uint8(CallType.unwrap(CALLTYPE_SINGLE)), "call type matches");
//         assertEq(reported, executionCalldata, "execution calldata propagated");
//     }

//     function testExecutorCanExecute() public {
//         account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");

//         bytes memory callData = abi.encodeWithSelector(MockTarget.increment.selector);

//         vm.prank(address(executor));
//         account.executeFromModule(address(target), 0, callData);

//         assertEq(target.counter(), 1, "executor executed call");
//     }

//     function testExecutorUnauthorizedReverts() public {
//         bytes memory callData = abi.encodeWithSelector(MockTarget.increment.selector);

//         vm.startPrank(address(validator));
//         vm.expectRevert(abi.encodeWithSelector(SmartAccount.ExecutorNotAuthorized.selector, address(validator)));
//         account.executeFromModule(address(target), 0, callData);
//         vm.stopPrank();
//     }

//     function testOnlyOwnerCanInstallModule() public {
//         vm.startPrank(stranger);
//         vm.expectRevert(SmartAccount.NotOwner.selector);
//         account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");
//         vm.stopPrank();
//     }

//     function testFallbackDelegatecallReturnsData() public {
//         account.installModule(MODULE_TYPE_FALLBACK, address(fallbackModule), "");
//         account.setActiveFallback(address(fallbackModule));

//         (bool success, bytes memory data) = address(account).call(abi.encodeWithSignature("doesNotExist()"));
//         assertTrue(success, "fallback should succeed");
//         assertEq(abi.decode(data, (uint256)), 777, "fallback return value");
//     }

//     function testFallbackWithoutHandlerReverts() public {
//         (bool success, bytes memory data) = address(account).call(hex"11223344");
//         assertFalse(success, "call should fail without fallback");
//         assertEq(bytes4(data), SmartAccount.FallbackHandlerNotSet.selector, "error selector matches");
//     }

//     function testListModulesPerType() public {
//         account.installModule(MODULE_TYPE_VALIDATOR, address(validator), "");
//         account.installModule(MODULE_TYPE_EXECUTOR, address(executor), "");
//         account.installModule(MODULE_TYPE_HOOK, address(hook), "");

//         address[] memory validators = account.listModules(MODULE_TYPE_VALIDATOR);
//         assertEq(validators.length, 1);
//         assertEq(validators[0], address(validator));

//         address[] memory executors = account.listModules(MODULE_TYPE_EXECUTOR);
//         assertEq(executors.length, 1);
//         assertEq(executors[0], address(executor));

//         address[] memory hooks = account.listModules(MODULE_TYPE_HOOK);
//         assertEq(hooks.length, 1);
//         assertEq(hooks[0], address(hook));
//     }
// }
