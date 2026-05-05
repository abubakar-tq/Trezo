import type { PreparedSend, SendIntent, SendValidationResult } from "@/src/features/send/types/send";
import type { PreparedSmartAccountExecution } from "@/src/features/wallet/types/execution";
import { encodeFunctionData, type Hex } from "viem";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export class SendPreparationService {
  static prepare(
    intent: SendIntent,
    validation: SendValidationResult,
  ): PreparedSend {
    if (!validation.isValid || !validation.normalized) {
      throw new Error("Cannot prepare send execution with invalid validation result.");
    }

    const { normalized } = validation;

    let targetAddress = normalized.recipient;
    let valueRaw = normalized.amountRaw;
    let calldata: Hex = "0x";

    if (normalized.token.type === "erc20") {
      targetAddress = normalized.token.address;
      valueRaw = 0n;
      const encodedTransfer = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [normalized.recipient, normalized.amountRaw],
      });

      if (!encodedTransfer.startsWith("0xa9059cbb")) {
        throw new Error("Unexpected ERC20 transfer selector while preparing calldata.");
      }

      calldata = encodedTransfer;
    }

    const execution: PreparedSmartAccountExecution = {
      chainId: intent.chainId,
      account: intent.walletAddress,
      target: targetAddress,
      value: valueRaw,
      data: calldata,
      operationLabel: normalized.token.type === "native" ? "send-native" : "send-erc20",
      riskLevel: "low",
      metadata: {
        tokenSymbol: normalized.token.symbol,
        tokenType: normalized.token.type,
        recipient: normalized.recipient,
        amountRaw: normalized.amountRaw.toString(),
      },
    };

    return {
      intent,
      validation: normalized,
      execution,
      targetAddress,
      valueRaw,
      calldata,
    };
  }
}
