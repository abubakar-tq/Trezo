import { BalanceService } from "@/src/features/assets/services/BalanceService";
import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";
import { getChainConfig } from "@/src/integration/chains";
import { getDeployment } from "@/src/integration/viem/deployments";
import WalletPersistenceService from "@/src/features/wallet/services/SupabaseWalletService";
import LocalPasskeyService from "@/src/features/wallet/services/PasskeyService";
import type { SendIntent, SendValidationError, SendValidationResult } from "@/src/features/send/types/send";
import { isAddress, parseUnits, type Address } from "viem";

export type SendValidationOptions = {
  feeMode?: "sponsored" | "wallet_paid";
  nativeGasReserveRaw?: bigint;
};

const pushError = (
  errors: SendValidationError[],
  code: SendValidationError["code"],
  field: SendValidationError["field"],
  message: string,
) => {
  errors.push({ code, field, message });
};

export class SendValidationService {
  private static readonly walletService = new WalletPersistenceService();

  static async validate(
    intent: SendIntent,
    options?: SendValidationOptions,
  ): Promise<SendValidationResult> {
    const errors: SendValidationError[] = [];
    const feeMode = options?.feeMode ?? "sponsored";

    const chain = getChainConfig(intent.chainId);
    if (!chain.isEnabled) {
      pushError(
        errors,
        "chain_disabled",
        "chain",
        `Chain ${chain.name} (${intent.chainId}) is disabled in this app environment.`,
      );
    }

    const deployment = getDeployment(intent.chainId);
    if (!deployment?.entryPoint || !deployment?.accountFactory) {
      pushError(
        errors,
        "chain_missing_deployment",
        "chain",
        `Deployment addresses are missing for chain ${intent.chainId}.`,
      );
    }

    const wallet = await this.walletService.getAAWalletForChain(intent.userId, intent.chainId);
    if (!wallet) {
      pushError(errors, "wallet_not_found", "wallet", "No smart account wallet was found for this chain.");
    } else {
      if (wallet.id !== intent.aaWalletId) {
        pushError(
          errors,
          "wallet_mismatch",
          "wallet",
          "The selected wallet does not match the current user's chain wallet.",
        );
      }

      if (!wallet.is_deployed) {
        pushError(errors, "wallet_not_deployed", "wallet", "Smart account is not deployed on this chain.");
      }

      if (wallet.predicted_address.toLowerCase() !== intent.walletAddress.toLowerCase()) {
        pushError(
          errors,
          "wallet_mismatch",
          "wallet",
          "Wallet address does not match deployed account metadata for this user.",
        );
      }
    }

    let recipient: Address | null = null;
    if (!isAddress(intent.recipient)) {
      pushError(errors, "recipient_invalid", "recipient", "Recipient must be a valid EVM address.");
    } else {
      recipient = intent.recipient as Address;
    }

    const registryToken = TokenRegistryService.getToken(intent.chainId, intent.token.address);
    if (!registryToken) {
      pushError(errors, "token_invalid", "token", "Selected token is not available on this chain.");
    }

    let amountRaw: bigint | null = null;
    try {
      amountRaw = parseUnits(intent.amountDecimal, intent.token.decimals);
      if (amountRaw <= 0n) {
        pushError(errors, "amount_zero", "amount", "Amount must be greater than zero.");
      }
    } catch {
      pushError(
        errors,
        "amount_invalid",
        "amount",
        `Amount is invalid for ${intent.token.symbol} precision (${intent.token.decimals} decimals).`,
      );
    }

    const passkey = await LocalPasskeyService.getPasskey(intent.userId);
    if (!passkey) {
      pushError(errors, "passkey_missing", "passkey", "No local passkey found. Create or restore a passkey first.");
    }

    if (errors.length > 0 || !recipient || !amountRaw || !registryToken) {
      return {
        isValid: false,
        errors,
      };
    }

    const { balanceRaw, spendableRaw } = await BalanceService.getSpendableBalance({
      chainId: intent.chainId,
      walletAddress: intent.walletAddress,
      token: registryToken,
      feeMode,
      nativeGasReserveRaw: options?.nativeGasReserveRaw,
    });

    if (amountRaw > spendableRaw) {
      pushError(
        errors,
        "insufficient_balance",
        "amount",
        `Insufficient balance. Spendable amount is ${spendableRaw.toString()} raw units.`,
      );
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
      };
    }

    return {
      isValid: true,
      errors: [],
      normalized: {
        walletAddress: intent.walletAddress,
        recipient,
        token: registryToken,
        amountRaw,
        balanceRaw,
        spendableRaw,
        feeMode,
      },
    };
  }
}
