/**
 * BridgeQuoteService.ts
 *
 * Computes a BridgeQuote for an Across V3 deposit. Quote is a pure local
 * computation: we use a flat per-route fee (BRIDGE_FLAT_FEE_BPS) because
 * Trezo runs the only relayer that watches testnets (see ADR 0008), so we
 * do not need to consult Across's hosted suggested-fees API.
 *
 * For cross-chain swap intents (outputToken != bridged canonical pair), the
 * destination-side Uniswap V3 swap is enforced by `BridgeMessage.minOut` —
 * see ADR 0007. This service does not call the destination chain's quoter.
 */

import {
  BRIDGE_FILL_DEADLINE_SECONDS,
  BRIDGE_FLAT_FEE_BPS,
  BRIDGE_QUOTE_VALIDITY_SECONDS,
  findBridgeOutputToken,
  getBridgeConfig,
} from "@/src/features/swaps/config/bridgeRegistry";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { BridgeQuote } from "@/src/features/swaps/types/bridge";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { type Address, zeroAddress } from "viem";

export type BridgeQuoteRequest = {
  sourceNetworkKey: NetworkKey;
  sourceChainId: SupportedChainId;
  destNetworkKey: NetworkKey;
  destChainId: SupportedChainId;
  account: Address;
  inputToken: TokenMetadata;
  outputToken: TokenMetadata;
  inputAmountRaw: bigint;
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
    if (request.inputToken.type !== "erc20") {
      throw new Error("Bridge currently only supports ERC20 inputs.");
    }
    if (request.outputToken.type !== "erc20") {
      throw new Error("Bridge currently only supports ERC20 outputs.");
    }
    if (request.sourceNetworkKey === request.destNetworkKey) {
      throw new Error("Source and destination networks must differ.");
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

    const destRecipient: Address = destSwapRequired
      ? (destConfig!.crossChainExecutor as Address)
      : request.account;

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
      expiresAt,
      routeMetadata: {
        bridgeId: "across_v3",
        canonicalDestToken,
        feeBps: BRIDGE_FLAT_FEE_BPS,
      },
    };
  }
}
