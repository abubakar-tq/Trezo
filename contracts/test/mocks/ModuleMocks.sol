// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

// import {
//     IModule,
//     IValidator,
//     IExecutor,
//     IHook,
//     IFallback,
//     MODULE_TYPE_VALIDATOR,
//     MODULE_TYPE_EXECUTOR,
//     MODULE_TYPE_FALLBACK,
//     MODULE_TYPE_HOOK,
//     VALIDATION_SUCCESS
// } from "lib/modulekit/src/accounts/common/interfaces/IERC7579Module.sol";
// import {PackedUserOperation} from "@ERC4337/account-abstraction/contracts/core/UserOperationLib.sol";

// abstract contract MockModuleBase is IModule {
//     mapping(address => bool) internal _initialized;

//     function onInstall(bytes calldata) external virtual override {
//         if (_initialized[msg.sender]) revert ModuleAlreadyInitialized(msg.sender);
//         _initialized[msg.sender] = true;
//     }

//     function onUninstall(bytes calldata) external virtual override {
//         if (!_initialized[msg.sender]) revert NotInitialized(msg.sender);
//         _initialized[msg.sender] = false;
//     }

//     function isInitialized(address smartAccount) external view override returns (bool) {
//         return _initialized[smartAccount];
//     }
// }

// contract MockValidator is MockModuleBase, IValidator {
//     uint256 public validationCount;
//     address public lastSender;

//     function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
//         return moduleTypeId == MODULE_TYPE_VALIDATOR;
//     }

//     function validateUserOp(PackedUserOperation calldata userOp, bytes32)
//         external
//         payable
//         override
//         returns (uint256)
//     {
//         validationCount += 1;
//         lastSender = userOp.sender;
//         return VALIDATION_SUCCESS;
//     }

//     function isValidSignatureWithSender(address, bytes32, bytes calldata)
//         external
//         pure
//         override
//         returns (bytes4)
//     {
//         return bytes4(0);
//     }
// }

// contract MockExecutor is MockModuleBase, IExecutor {
//     function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
//         return moduleTypeId == MODULE_TYPE_EXECUTOR;
//     }
// }

// contract MockHook is MockModuleBase, IHook {
//     uint256 public preCallCount;
//     uint256 public postCallCount;
//     address public lastSender;
//     uint256 public lastValue;
//     bytes public lastData;

//     function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
//         return moduleTypeId == MODULE_TYPE_HOOK;
//     }

//     function preCheck(address msgSender, uint256 msgValue, bytes calldata msgData)
//         external
//         override
//         returns (bytes memory)
//     {
//         preCallCount += 1;
//         lastSender = msgSender;
//         lastValue = msgValue;
//         lastData = msgData;
//         return abi.encode(msgSender, msgValue, msgData.length);
//     }

//     function postCheck(bytes calldata) external override {
//         postCallCount += 1;
//     }
// }

// contract MockFallback is MockModuleBase, IFallback {
//     function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
//         return moduleTypeId == MODULE_TYPE_FALLBACK;
//     }

//     receive() external payable {}

//     fallback() external payable {
//         assembly {
//             mstore(0, 777)
//             return(0, 32)
//         }
//     }
// }

contract MockTarget {
    uint256 public counter;

    function increment() external {
        counter += 1;
    }
}
