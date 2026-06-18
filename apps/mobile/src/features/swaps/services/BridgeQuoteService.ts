/**
 * BridgeQuoteService.ts
 *
 * Computes a BridgeQuote. Routes to LI.FI for mainnet (base-mainnet,
 * arb-mainnet) and to Across V3 for testnet (base-sepolia, arb-sepolia,
 * ethereum-sepolia). The Across fee is a flat per-route compute
 * (BRIDGE_FLAT_FEE_BPS) because Trezo runs the only relayer that watches
 * testnets. LI.FI quotes are fetched live from the LI.FI routing API.
 *
 * When the Across path picks an outputToken that differs from the route's
 * canonical pair, this service ALSO calls BridgeDestQuoteService to query the
 * destination chain's Uniswap V3 quoter and produce the (minOut, feeTier,
 * deadline) the CrossChainExecutor will enforce.
 */

import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";
import {
  BRIDGE_FILL_DEADLINE_SECONDS,
  BRIDGE_FLAT_FEE_BPS,
  BRIDGE_QUOTE_VALIDITY_SECONDS,
  findBridgeOutputToken,
  getBridgeConfig,
} from "@/src/features/swaps/config/bridgeRegistry";
import { BridgeDestQuoteService } from "@/src/features/swaps/services/BridgeDestQuoteService";
import { LiFiBridgeProvider } from "@/src/features/swaps/providers/LiFiBridgeProvider";
import { isLifiBridgeRoute } from "@/src/features/swaps/lifi/constants";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { BridgeDestSwap, BridgeQuote } from "@/src/features/swaps/types/bridge";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { type Address, zeroAddress } from "viem";

export type BridgeQuoteRequest = {
  sourceNetworkKey: NetworkKey;
  sourceChainId: SupportedChainId;
  destNetworkKey: NetworkKey;
  destChainId: SupportedChainId;
  /** Source-chain depositor address (the wallet that signs depositV3). */
  account: Address;
  /**
   * Destination-chain recipient address. For same-asset bridges this is
   * exactly where the SpokePool delivers funds. For cross-chain swaps it's
   * carried inside the BridgeMessage and used by the executor to forward
   * swapped tokens. Defaults to `account` if the caller does not pass one.
   */
  destAccount?: Address;
  inputToken: TokenMetadata;
  outputToken: TokenMetadata;
  inputAmountRaw: bigint;
  /**
   * Slippage tolerance for the destination-side swap when destSwapRequired.
   * Ignored for same-asset bridges.
   */
  destSwapSlippageBps?: number;
};

const applyFee = (amount: bigint, feeBps: number): bigint =>
  (amount * BigInt(10_000 - feeBps)) / 10_000n;

const tokensEqual = (a: Address, b: Address): boolean =>
  a.toLowerCase() === b.toLowerCase();

export class BridgeQuoteService {
  static async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote> {
    if (request.inputAmountRaw <= 0n) {
      throw new Error("Bridge amount must be greater than zero.");
    }
    if (request.sourceNetworkKey === request.destNetworkKey) {
      throw new Error("Source and destination networks must differ.");
    }

    // ── LI.FI path (mainnet: base-mainnet, arb-mainnet, eth-mainnet) ──────────
    if (isLifiBridgeRoute(request.sourceNetworkKey, request.destNetworkKey)) {
      const provider = new LiFiBridgeProvider();
      const routeQuote = await provider.getRoute({
        sourceNetworkKey: request.sourceNetworkKey,
        sourceChainId: request.sourceChainId,
        destNetworkKey: request.destNetworkKey,
        destChainId: request.destChainId,
        account: request.account,
        destAccount: request.destAccount,
        inputToken: request.inputToken,
        outputToken: request.outputToken,
        inputAmountRaw: request.inputAmountRaw,
        slippageBps: request.destSwapSlippageBps ?? 50,
      });
      const nowSec = Math.floor(Date.now() / 1000);
      return {
        quoteId: `lifi-bridge-${request.sourceNetworkKey}-${request.destNetworkKey}-${nowSec}`,
        sourceNetworkKey: request.sourceNetworkKey,
        sourceChainId: request.sourceChainId,
        destNetworkKey: request.destNetworkKey,
        destChainId: request.destChainId,
        inputToken: request.inputToken,
        outputToken: request.outputToken,
        inputAmountRaw: request.inputAmountRaw,
        outputAmountRaw: routeQuote.estimatedOutRaw,
        feeBps: routeQuote.feeBps ?? 0,
        quoteTimestamp: nowSec,
        fillDeadline: nowSec + (routeQuote.etaSeconds ?? 3600),
        exclusivityDeadline: 0,
        exclusiveRelayer: zeroAddress,
        // Use the LI.FI Diamond as the spender for approval checks.
        spokePool: routeQuote.spender ?? zeroAddress,
        destRecipient: request.destAccount ?? request.account,
        destSwapRequired: false,
        expiresAt: new Date((nowSec + 60) * 1000).toISOString(),
        routeMetadata: {
          provider: "lifi",
          bridgeId: "lifi",
          routeLabel: routeQuote.routeLabel,
          etaSeconds: routeQuote.etaSeconds,
          // Execution-ready fields for BridgePreparationService.
          target: routeQuote.target,
          calldata: routeQuote.calldata,
          value: routeQuote.value ?? 0n,
          spender: routeQuote.spender,
        },
      };
    }

    // ── Across V3 path (testnet) ───────────────────────────────────────────────
    if (request.inputToken.type !== "erc20") {
      throw new Error("Bridge currently only supports ERC20 inputs.");
    }
    if (request.outputToken.type !== "erc20") {
      throw new Error("Bridge currently only supports ERC20 outputs.");
    }

    const sourceConfig = getBridgeConfig(request.sourceNetworkKey);
    if (!sourceConfig?.spokePool) {
      throw new Error(`No Across SpokePool configured for ${request.sourceNetworkKey}.`);
    }

    // The canonical output token on the destination side for the bridged input.
    // For a same-asset bridge, outputToken === canonicalDestToken.
    // For a cross-chain swap, the executor swaps canonical -> outputToken on arrival.
    const canonicalDestToken = findBridgeOutputToken(
      request.sourceNetworkKey,
      request.destNetworkKey,
      request.inputToken.address,
    );
    if (!canonicalDestToken) {
      throw new Error(
        `No allowlisted bridge route for ${request.inputToken.symbol} on ${request.sourceNetworkKey} -> ${request.destNetworkKey}.`,
      );
    }

    const destSwapRequired = !tokensEqual(canonicalDestToken, request.outputToken.address);

    // Executor is only required when the destination needs a swap on arrival.
    // For same-asset bridges we deliver directly to the user — no executor hop.
    const destConfig = getBridgeConfig(request.destNetworkKey);
    if (destSwapRequired && !destConfig?.crossChainExecutor) {
      throw new Error(
        `Cross-chain swap requires CrossChainExecutor on ${request.destNetworkKey}, but it is not deployed yet.`,
      );
    }

    const effectiveDestAccount: Address = request.destAccount ?? request.account;
    const destRecipient: Address = destSwapRequired
      ? (destConfig!.crossChainExecutor as Address)
      : effectiveDestAccount;

    // Flat fee on the input amount. The Across V3 outputAmount is what the
    // recipient receives BEFORE any destination-side swap. The relayer fills
    // the deposit with `outputAmount` of canonicalDestToken; the executor then
    // either forwards or swaps to outputToken.
    const outputAmountRaw = applyFee(request.inputAmountRaw, BRIDGE_FLAT_FEE_BPS);
    if (outputAmountRaw <= 0n) {
      throw new Error("Bridge output amount rounds to zero — input is too small.");
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const fillDeadline = nowSec + BRIDGE_FILL_DEADLINE_SECONDS;

    const expiresAt = new Date((nowSec + BRIDGE_QUOTE_VALIDITY_SECONDS) * 1000).toISOString();

    // ── Destination-side swap quote (only when output token differs) ───────────
    let destSwap: BridgeDestSwap | undefined;
    if (destSwapRequired) {
      const canonicalDestTokenMeta = TokenRegistryService.getTokenForNetwork(
        request.destNetworkKey,
        canonicalDestToken,
      );
      if (!canonicalDestTokenMeta) {
        throw new Error(
          `Canonical destination token ${canonicalDestToken} for ${request.inputToken.symbol} `
            + `is not registered on ${request.destNetworkKey}. Add it to tokenRegistry.`,
        );
      }

      const slippageBps = request.destSwapSlippageBps ?? 100; // default 1% if caller didn't pass one
      const destQuote = await BridgeDestQuoteService.getQuote({
        destNetworkKey: request.destNetworkKey,
        canonicalToken: canonicalDestTokenMeta,
        outputToken: request.outputToken,
        // The executor receives `outputAmountRaw` of the canonical token from the SpokePool;
        // that is what gets swapped on the destination side.
        inputAmountRaw: outputAmountRaw,
        slippageBps,
        // Swap deadline matches the Across fill deadline so the dest swap window
        // covers the relayer's fill window. If the relayer misses fillDeadline,
        // the deposit refunds on source — no dest swap will ever run.
        deadlineSec: fillDeadline,
      });
      destSwap = {
        canonicalToken: canonicalDestTokenMeta,
        expectedOutRaw: destQuote.expectedOutRaw,
        minOutRaw: destQuote.minOutRaw,
        feeTier: destQuote.feeTier,
        poolAddress: destQuote.poolAddress,
        slippageBps: destQuote.slippageBps,
        deadlineSec: destQuote.deadlineSec,
      };
    }

    return {
      quoteId: `across-v3-${request.sourceNetworkKey}-${request.destNetworkKey}-${request.inputToken.symbol}-${nowSec}`,
      sourceNetworkKey: request.sourceNetworkKey,
      sourceChainId: request.sourceChainId,
      destNetworkKey: request.destNetworkKey,
      destChainId: request.destChainId,
      inputToken: request.inputToken,
      outputToken: request.outputToken,
      inputAmountRaw: request.inputAmountRaw,
      outputAmountRaw,
      feeBps: BRIDGE_FLAT_FEE_BPS,
      quoteTimestamp: nowSec,
      fillDeadline,
      exclusivityDeadline: 0,
      exclusiveRelayer: zeroAddress,
      spokePool: sourceConfig.spokePool,
      destExecutor: destConfig?.crossChainExecutor,
      destRecipient,
      destSwapRequired,
      destSwap,
      expiresAt,
      routeMetadata: {
        bridgeId: "across_v3",
        canonicalDestToken,
        feeBps: BRIDGE_FLAT_FEE_BPS,
      },
    };
  }
}
