import type { SupportedChainId } from "@/src/integration/chains";
import { getPasskeyOnchainState, isContractDeployed } from "@/src/integration/viem";
import type { Address } from "viem";

import PasskeyService from "./PasskeyService";

export type LocalWalletSignerReason =
  | "verified"
  | "no_user"
  | "no_local_passkey"
  | "wallet_metadata_mismatch"
  | "wallet_not_loaded"
  | "wallet_not_deployed"
  | "onchain_passkey_missing"
  | "verification_failed";

export type LocalWalletSignerStatus = {
  hasLocalPasskey: boolean;
  localPasskeyId: `0x${string}` | null;
  canSignForWallet: boolean;
  walletDeployedOnChain: boolean;
  metadataMatchesWallet: boolean | null;
  reason: LocalWalletSignerReason;
  verificationError: string | null;
};

type GetWalletSignerStatusParams = {
  userId?: string | null;
  smartAccountAddress?: Address | null;
  chainId?: SupportedChainId | null;
  expectedPasskeyId?: string | null;
};

const normalizeHexId = (value: string | null | undefined): `0x${string}` | null => {
  if (!value) return null;
  const normalized = value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
  return normalized as `0x${string}`;
};

export class LocalSignerService {
  static async getWalletSignerStatus(
    params: GetWalletSignerStatusParams,
  ): Promise<LocalWalletSignerStatus> {
    if (!params.userId) {
      return {
        hasLocalPasskey: false,
        localPasskeyId: null,
        canSignForWallet: false,
        walletDeployedOnChain: false,
        metadataMatchesWallet: null,
        reason: "no_user",
        verificationError: null,
      };
    }

    const localPasskey = await PasskeyService.getPasskey(params.userId);
    const localPasskeyId = normalizeHexId(localPasskey?.credentialIdRaw);
    const expectedPasskeyId = normalizeHexId(params.expectedPasskeyId);
    const metadataMatchesWallet =
      localPasskeyId && expectedPasskeyId
        ? localPasskeyId === expectedPasskeyId
        : expectedPasskeyId
          ? false
          : null;

    if (!localPasskeyId) {
      return {
        hasLocalPasskey: false,
        localPasskeyId: null,
        canSignForWallet: false,
        walletDeployedOnChain: false,
        metadataMatchesWallet,
        reason: "no_local_passkey",
        verificationError: null,
      };
    }

    if (!params.smartAccountAddress || !params.chainId) {
      return {
        hasLocalPasskey: true,
        localPasskeyId,
        canSignForWallet: true,
        walletDeployedOnChain: false,
        metadataMatchesWallet,
        reason: "wallet_not_loaded",
        verificationError: null,
      };
    }

    let walletDeployedOnChain = false;
    let verificationError: string | null = null;

    try {
      walletDeployedOnChain = await isContractDeployed(
        params.chainId,
        params.smartAccountAddress,
      );
    } catch (error) {
      verificationError =
        error instanceof Error ? error.message : "Failed to verify wallet deployment";
    }

    if (!walletDeployedOnChain) {
      if (expectedPasskeyId && metadataMatchesWallet === false) {
        return {
          hasLocalPasskey: true,
          localPasskeyId,
          canSignForWallet: false,
          walletDeployedOnChain: false,
          metadataMatchesWallet,
          reason: "wallet_metadata_mismatch",
          verificationError,
        };
      }

      return {
        hasLocalPasskey: true,
        localPasskeyId,
        canSignForWallet: true,
        walletDeployedOnChain: false,
        metadataMatchesWallet,
        reason: "wallet_not_deployed",
        verificationError,
      };
    }

    try {
      const onchainState = await getPasskeyOnchainState({
        chainId: params.chainId,
        smartAccountAddress: params.smartAccountAddress,
        passkeyId: localPasskeyId,
      });

      if (!onchainState.exists) {
        return {
          hasLocalPasskey: true,
          localPasskeyId,
          canSignForWallet: false,
          walletDeployedOnChain: true,
          metadataMatchesWallet,
          reason: "onchain_passkey_missing",
          verificationError: null,
        };
      }

      return {
        hasLocalPasskey: true,
        localPasskeyId,
        canSignForWallet: true,
        walletDeployedOnChain: true,
        metadataMatchesWallet,
        reason: "verified",
        verificationError: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to verify passkey on-chain";

      if (expectedPasskeyId && metadataMatchesWallet === false) {
        return {
          hasLocalPasskey: true,
          localPasskeyId,
          canSignForWallet: false,
          walletDeployedOnChain: true,
          metadataMatchesWallet,
          reason: "onchain_passkey_missing",
          verificationError: message,
        };
      }

      return {
        hasLocalPasskey: true,
        localPasskeyId,
        canSignForWallet: Boolean(metadataMatchesWallet ?? true),
        walletDeployedOnChain: true,
        metadataMatchesWallet,
        reason: "verification_failed",
        verificationError: message,
      };
    }
  }
}

export default LocalSignerService;
