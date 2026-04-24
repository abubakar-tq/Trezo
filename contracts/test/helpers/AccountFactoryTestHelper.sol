// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PasskeyTypes} from "src/common/Types.sol";

abstract contract AccountFactoryTestHelper is Test {
    function _createAuthorizedAccount(
        AccountFactory accountFactory,
        bytes32 walletId,
        uint256 walletIndex,
        address validator,
        PasskeyTypes.PasskeyInit memory passkey
    )
        internal
        returns (address)
    {
        return _createAccount(accountFactory, walletId, walletIndex, validator, passkey);
    }

    function _createAccount(
        AccountFactory accountFactory,
        bytes32 walletId,
        uint256 walletIndex,
        address validator,
        PasskeyTypes.PasskeyInit memory passkey
    )
        internal
        returns (address)
    {
        return accountFactory.createAccount(walletId, walletIndex, validator, passkey);
    }
}
