// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MinimalProxyFactory} from "src/proxy/MinimalProxyFactory.sol";
import {SmartAccount} from "src/account/SmartAccount.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {DeployAccount} from "script/DeployAccount.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {PasskeyValidator} from "src/modules/passkey/PasskeyValidator.sol";
import {PassKeyDemo} from "test/utils/PasskeyCred.sol";
contract MinimalTest is Test {

    SmartAccount implementation;
    MinimalProxyFactory factory;
    address proxy;
    AccountFactory accountFactory;
    HelperConfig helperConfig;
    PasskeyValidator passkeyValidator;

    function setUp() public {
        DeployAccount deployer = new DeployAccount();
        (helperConfig, implementation,  factory, accountFactory,passkeyValidator) = deployer.deployAccount();


        proxy = accountFactory.createAccount(keccak256("user1"), address(passkeyValidator), PassKeyDemo.getPasskeyInit(0));
        
        console2.log("Setup complete");
    }

    function testProxyDelegation() public {
       
        // Verify proxy address is not zero
        assert(proxy != address(0));
      
        (bool ok, bytes memory ret) = proxy.call(abi.encodeWithSelector(SmartAccount.ping.selector));
        require(ok, "Delegatecall failed");
        (bytes32 who) = abi.decode(ret, (bytes32));
        assert(who != bytes32(0));
    }

    // /**
    //  * @notice Execute with PasskeyValidator using off-chain P-256 r,s pasted below.
    //  * @dev If r or s are zero, the test will skip execution to keep CI passing.
    //  */
    // function testTransferWithPassKey() public {
    //     address target = makeAddr("target2");
    //     uint256 startBal = target.balance;
    //     uint256 value = 0.05 ether;

    //     UserOpData memory userOpData =
    //         instance.getExecOps({target: target, value: value, callData: "", txValidator: address(validator)});

    //     bytes memory ad = WebAuthnTestUtils.buildAuthenticatorData(rpIdHash, true, 1);
    //     (string memory cjson, uint256 cIdx, uint256 tIdx) =
    //         WebAuthnTestUtils.buildClientDataJSONAndIndices(userOpData.userOpHash);
    //     bytes32 msgHash = WebAuthnTestUtils.webAuthnMessageHash(ad, cjson);
    //     console2.log("Passkey msgHash (sign off-chain and paste r,s)");
    //     console2.logBytes32(msgHash);

    //     uint256 r = 0x011c9b597a9d140fbb97ed9aa2e2f0239115352e25c5bdcbda9460e61130c172;
    //     uint256 s = 0x7030fa31d9589781eb906106c7e62241235d3d3508bb9731b64a9799219c6383;
    //     if (r == 0 || s == 0) {
    //         console2.log("Skipping execution: provide non-zero r,s to run");
    //         return;
    //     }

    //     bytes memory sig = WebAuthnTestUtils.encodePasskeySignature(dummyId, ad, cjson, cIdx, tIdx, r, s);
    //     userOpData.userOp.signature = sig;
    //     userOpData.execUserOps();

    //     assertEq(target.balance, startBal + value, "target2 should receive value");
    // }
}
