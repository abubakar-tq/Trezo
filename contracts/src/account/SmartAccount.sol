// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IAccount} from "lib/account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "lib/account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "lib/account-abstraction/contracts/core/Helpers.sol";
import {IEntryPoint} from "lib/account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {AccountStorage} from "./AccountStorage.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SmartAccount is IAccount {
    using AccountStorage for AccountStorage.Layout;

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event OwnerSet(address indexed owner);

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error MinimalAccount__NotFromEntryPoint();
    error MinimalAccount__NotFromEntryPointOrOwner();
    error MinimalAccount__CallFailed(bytes);
    error AlreadyInitialized();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier requireFromEntryPoint() {
        if (msg.sender != AccountStorage.layout().entryPoint) {
            revert MinimalAccount__NotFromEntryPoint();
        }
        _;
    }

    modifier requireFromEntryPointOrOwner() {
        if (msg.sender != AccountStorage.layout().entryPoint && msg.sender != AccountStorage.layout().owner) {
            revert MinimalAccount__NotFromEntryPointOrOwner();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                               FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev For receiving the ether
     */
    receive() external payable {}

    /*//////////////////////////////////////////////////////////////
                                EXTERNAL
    //////////////////////////////////////////////////////////////*/

    /**
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds The amount of funds that are missing from the account
     * @dev This function validates the user operation by checking the signature and paying the missing funds
     * @dev This must be called from the entry point
     * @return validationData The validation data
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        requireFromEntryPoint
        returns (uint256 validationData)
    {
        //this will be called by entrypoint.sol so you have to check the validity of the user operation

        validationData = _validateSignature(userOp, userOpHash);

        _payPrefund(missingAccountFunds);
    }

    /**
     * @param dest The address of the destination contract
     * @param value The amount of Ether to send
     * @param functionData The data to send to the destination contract
     * @dev This function can be called by owner and the entry point after verification of signature
     */
    function execute(address dest, uint256 value, bytes calldata functionData) external requireFromEntryPointOrOwner {
        (bool success, bytes memory result) = dest.call{value: value}(functionData);
        if (!success) {
            revert MinimalAccount__CallFailed(result);
        }
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @dev The signature will be valid only if it was signed by the owner of "this" contract
     * @dev The function will return SIG_VALIDATION_SUCCESS if the signature is valid, and SIG_VALIDATION_FAILED otherwise
     * @return validationData The validation data
     */
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        returns (uint256 validationData)
    {
       

        (address signer,,) = ECDSA.tryRecover(userOpHash, userOp.signature);

        if (signer != AccountStorage.layout().owner) {
            return SIG_VALIDATION_FAILED;
        }

        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @param missingAccountFunds The amount of funds that are missing from the account
     * @dev This function attempts to pay the missing funds to the account.
     */
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds != 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds, gas: type(uint256).max}("");
            (success);
        }
    }

    /*//////////////////////////////////////////////////////////////
                                GETTERS
    //////////////////////////////////////////////////////////////*/
    function getEntryPoint() external view returns (address) {
        return AccountStorage.layout().entryPoint;
    }

    function getNonce(uint192 key) external view returns (uint256) {
        return IEntryPoint(AccountStorage.layout().entryPoint).getNonce(address(this), key);
    }

    function getInitialized() external view returns (bool) {
        return AccountStorage.layout().initialized;
    }

    function getOwner() external view returns (address) {
        return AccountStorage.layout().owner;
    }

    /*//////////////////////////////////////////////////////////////
                            Initializer FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function initialize(address _owner, address _entryPoint) external {
        AccountStorage.Layout storage s = AccountStorage.layout();
        if (s.initialized) revert AlreadyInitialized();
        s.owner = _owner;
        s.entryPoint = _entryPoint;
        s.initialized = true;
        emit OwnerSet(_owner);
    }

    // a no-op example function just to prove delegatecall works
    function ping() external view returns (bytes32 who, address _owner) {
        return (blockhash(block.number - 1), msg.sender);
    }
}
