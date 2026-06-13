/**
 * AllowanceService.ts
 *
 * ERC20 allowance checking and approval preparation.
 *
 * New API (network-key aware):
 *   getAllowance({ networkKey, ... })
 *   isApprovalRequired({ networkKey, ... })
 *   prepareApprovalExecution({ networkKey, ... })
 *
 * Legacy API (chain-id based):
 *   getAllowance({ chainId, ... })
 *   isApprovalRequired({ chainId, ... })
 *   prepareApprovalExecution({ chainId, ... })
 *
 * Both variants are accepted via a union type so callers can pass either.
 */

import {
  isTrustedSpenderForChain,
  isTrustedSpenderForNetwork,
} from "@/src/features/swaps/config/swapProviders";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { PreparedSmartAccountExecution } from "@/src/features/wallet/types/execution";
import { getPublicClient, getPublicClientForNetwork } from "@/src/integration/viem/clients";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";
import { encodeFunctionData, type Address, type Hex } from "viem";
import { withTimeoutAndRetry } from "@/src/features/swaps/utils/withTimeoutAndRetry";

const ERC20_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const assertTrustedSpender = (
  chainOrNetwork: { chainId: SupportedChainId } | { networkKey: NetworkKey },
  spender: Address
): void => {
  if ("networkKey" in chainOrNetwork) {
    if (!isTrustedSpenderForNetwork(chainOrNetwork.networkKey, spender)) {
      throw new Error(
        `Untrusted spender for network ${chainOrNetwork.networkKey}: ${spender}`
      );
    }
  } else {
    if (!isTrustedSpenderForChain(chainOrNetwork.chainId, spender)) {
      throw new Error(
        `Untrusted spender for chain ${chainOrNetwork.chainId}: ${spender}`
      );
    }
  }
};

const resolvePublicClient = (
  chainOrNetwork: { chainId: SupportedChainId } | { networkKey: NetworkKey }
) => {
  if ("networkKey" in chainOrNetwork) {
    return getPublicClientForNetwork(chainOrNetwork.networkKey);
  }
  return getPublicClient(chainOrNetwork.chainId);
};

// ─── AllowanceService ─────────────────────────────────────────────────────────

export class AllowanceService {
  static async getAllowance(params: {
    chainId?: SupportedChainId;
    networkKey?: NetworkKey;
    tokenAddress: Address;
    owner: Address;
    spender: Address;
  }): Promise<bigint> {
    const resolver = params.networkKey
      ? { networkKey: params.networkKey }
      : { chainId: params.chainId! };

    const client = resolvePublicClient(resolver);
    const raw = await withTimeoutAndRetry(
      () => client.readContract({
        address: params.tokenAddress,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: "allowance",
        args: [params.owner, params.spender],
      }),
      { timeoutMs: 8000 },
    );
    return raw as bigint;
  }

  static async isApprovalRequired(params: {
    token: TokenMetadata;
    sellAmountRaw: bigint;
    owner: Address;
    spender: Address;
    chainId?: SupportedChainId;
    networkKey?: NetworkKey;
  }): Promise<{ required: boolean; allowanceRaw: bigint | null }> {
    if (params.token.type === "native") {
      return { required: false, allowanceRaw: null };
    }

    const resolver = params.networkKey
      ? { networkKey: params.networkKey }
      : { chainId: params.chainId! };

    assertTrustedSpender(resolver, params.spender);

    const allowanceRaw = await this.getAllowance({
      ...resolver,
      tokenAddress: params.token.address,
      owner: params.owner,
      spender: params.spender,
    });

    return {
      required: allowanceRaw < params.sellAmountRaw,
      allowanceRaw,
    };
  }

  static buildApprovalCalldata(spender: Address, amountRaw: bigint): Hex {
    return encodeFunctionData({
      abi: ERC20_ALLOWANCE_ABI,
      functionName: "approve",
      args: [spender, amountRaw],
    }) as Hex;
  }

  static prepareApprovalExecution(params: {
    chainId: SupportedChainId;
    networkKey?: NetworkKey;
    account: Address;
    token: TokenMetadata;
    spender: Address;
    amountRaw: bigint;
  }): PreparedSmartAccountExecution {
    if (params.token.type !== "erc20") {
      throw new Error("Native token does not require approval execution.");
    }
    if (params.amountRaw <= 0n) {
      throw new Error("Approval amount must be greater than zero.");
    }

    const resolver = params.networkKey
      ? { networkKey: params.networkKey }
      : { chainId: params.chainId };
    assertTrustedSpender(resolver, params.spender);

    const calldata = this.buildApprovalCalldata(params.spender, params.amountRaw);
    if (!calldata.startsWith("0x095ea7b3")) {
      throw new Error("Unexpected approve selector while preparing approval calldata.");
    }

    return {
      chainId: params.chainId,
      networkKey: params.networkKey,
      account: params.account,
      target: params.token.address,
      value: 0n,
      data: calldata,
      operationLabel: "swap-token-approval",
      riskLevel: "low",
      metadata: {
        tokenAddress: params.token.address,
        tokenSymbol: params.token.symbol,
        spender: params.spender,
        amountRaw: params.amountRaw.toString(),
        approvalType: "exact",
      },
    };
  }
}
