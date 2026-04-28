// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccountFactory} from "src/factory/AccountFactory.sol";
import {PasskeyTypes} from "src/common/Types.sol";
import {SafeRootDeployFixture} from "./SafeRootDeployFixture.sol";

abstract contract AccountFactoryTestHelper is SafeRootDeployFixture {
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
