// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PasskeyTypes} from "src/common/Types.sol";

contract PredictWallet is Script {
    function run() external view returns (address portable, address chainSpecific) {
        address accountFactoryAddress = vm.envAddress("ACCOUNT_FACTORY");
        bytes32 walletId = vm.envBytes32("WALLET_ID");
        uint256 walletIndex = vm.envOr("WALLET_INDEX", uint256(0));
        address validator = vm.envAddress("VALIDATOR");
        bytes32 passkeyIdRaw = vm.envBytes32("PASSKEY_ID_RAW");
        uint256 passkeyPx = vm.envUint("PASSKEY_PX");
        uint256 passkeyPy = vm.envUint("PASSKEY_PY");

        AccountFactory accountFactory = AccountFactory(accountFactoryAddress);
        PasskeyTypes.PasskeyInit memory passkeyInit =
            PasskeyTypes.PasskeyInit({idRaw: passkeyIdRaw, px: passkeyPx, py: passkeyPy});
        portable = accountFactory.predictAccount(walletId, walletIndex, validator, passkeyInit);
        chainSpecific = accountFactory.predictChainSpecificAccount(walletId, walletIndex, validator, passkeyInit);

        console2.log("=== PredictWallet ===");
        console2.log("chainId:", block.chainid);
        console2.log("walletIndex:", walletIndex);
        console2.log("validator:", validator);
        console2.log("portable:", portable);
        console2.log("chainSpecific:", chainSpecific);
    }
}
