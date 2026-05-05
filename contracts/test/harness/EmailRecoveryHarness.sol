// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {EmailRecovery} from "src/modules/EmailRecovery/EmailRecovery.sol";

/**
 * @title EmailRecoveryHarness
 * @notice DEV-ONLY harness that exposes internal guardian-acceptance and recovery-processing
 *         functions inherited from EmailRecoveryManager. Used by local Foundry tests and
 *         Anvil mock scripts to simulate the ZK Email manager flow without real email proofs.
 *
 *         This contract is NEVER deployed to testnet or production. It lives under
 *         test/harness/ and is only referenced by dev scripts in script/dev/.
 *
 *         Production EmailRecovery.sol is NOT modified — no public bypass functions are added.
 */
contract EmailRecoveryHarness is EmailRecovery {
    constructor(
        address verifier,
        address dkimRegistry,
        address emailAuthImpl,
        address commandHandler,
        uint256 minimumDelay,
        address killSwitchAuthorizer
    )
        EmailRecovery(verifier, dkimRegistry, emailAuthImpl, commandHandler, minimumDelay, killSwitchAuthorizer)
    {}

    /**
     * @notice Exposes the internal acceptGuardian from EmailRecoveryManager.
     *         Simulates a guardian accepting their role after ZK Email verification.
     */
    function exposedAcceptGuardian(address guardian, uint256 templateIdx, bytes[] memory commandParams)
        external
    {
        acceptGuardian(guardian, templateIdx, commandParams, bytes32(0));
    }

    /**
     * @notice Exposes the internal processRecovery from EmailRecoveryManager.
     *         Simulates a guardian voting for a recovery request after ZK Email verification.
     */
    function exposedProcessRecovery(address guardian, uint256 templateIdx, bytes[] memory commandParams)
        external
    {
        processRecovery(guardian, templateIdx, commandParams, bytes32(0));
    }
}
