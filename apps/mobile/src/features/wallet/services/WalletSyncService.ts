import { deriveDefaultWalletId } from "@/src/features/wallet/services/AccountDeploymentService";
import type { AAAccount } from "@/src/features/wallet/store/useWalletStore";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
  DEFAULT_CHAIN_ID,
  type SupportedChainId,
} from "@/src/integration/chains";
import { isContractDeployed } from "@/src/integration/viem";
import { useUserStore } from "@store/useUserStore";
import type { Address } from "viem";

import {
  SupabaseWalletService,
  type AAWallet,
} from "./SupabaseWalletService";

type PersistWalletMetadataParams = {
  userId: string;
  predictedAddress: string;
  ownerAddress: string;
  walletName: string;
  chainId: number;
  walletId?: string;
  walletIndex?: number;
  deploymentMode?: "portable" | "chain-specific";
  isDeployed?: boolean;
  deploymentTxHash?: string | null;
  deploymentBlockNumber?: number | null;
  deployedAt?: string | null;
};

type HydrateWalletParams = {
  userId: string;
  preferredChainId?: SupportedChainId;
  verifyOnChain?: boolean;
};

export class WalletSyncService {
  private static walletService = new SupabaseWalletService();

  static toAAAccount(wallet: AAWallet, isDeployed = wallet.is_deployed): AAAccount {
    return {
      id: wallet.id,
      userId: wallet.user_id,
      walletId: wallet.wallet_identity ?? deriveDefaultWalletId(wallet.user_id),
      walletIndex: wallet.wallet_index ?? 0,
      deploymentMode: wallet.deployment_mode ?? "chain-specific",
      predictedAddress: wallet.predicted_address,
      ownerAddress: wallet.owner_address,
      isDeployed,
      deploymentTxHash: wallet.deployment_tx_hash ?? undefined,
      deploymentBlockNumber: wallet.deployment_block_number ?? undefined,
      walletName: wallet.wallet_name,
      chainId: wallet.chain_id,
      createdAt: wallet.created_at,
      deployedAt: wallet.deployed_at ?? undefined,
    };
  }

  static applyWalletToStores(wallet: AAWallet, isDeployed = wallet.is_deployed): AAAccount {
    const account = this.toAAAccount(wallet, isDeployed);
    useWalletStore.getState().setAAAccount(account);
    useUserStore.getState().setSmartAccountAddress(account.predictedAddress);
    useUserStore.getState().setSmartAccountDeployed(isDeployed);
    return account;
  }

  static clearWalletState(): void {
    useWalletStore.getState().setAAAccount(null);
    useWalletStore.getState().setDeploymentStatus("idle");
    useUserStore.getState().setSmartAccountAddress(null);
    useUserStore.getState().setSmartAccountDeployed(false);
  }

  static async persistWalletMetadata(
    params: PersistWalletMetadataParams,
  ): Promise<AAWallet> {
    return this.walletService.saveAAWallet({
      userId: params.userId,
      predictedAddress: params.predictedAddress,
      ownerAddress: params.ownerAddress,
      walletName: params.walletName,
      chainId: params.chainId,
      walletId: params.walletId,
      walletIndex: params.walletIndex,
      deploymentMode: params.deploymentMode,
      isDeployed: params.isDeployed,
      deploymentTxHash: params.deploymentTxHash,
      deploymentBlockNumber: params.deploymentBlockNumber,
      deployedAt: params.deployedAt,
    });
  }

  static async hydrateWalletForUser(
    params: HydrateWalletParams,
  ): Promise<AAAccount | null> {
    const chainId =
      params.preferredChainId ?? (useWalletStore.getState().activeChainId as SupportedChainId);
    const wallet =
      (await this.walletService.getAAWalletForChain(params.userId, chainId).catch(() => null)) ??
      (await this.walletService.getAAWallet(params.userId).catch(() => null));

    if (!wallet) {
      this.clearWalletState();
      return null;
    }

    let resolvedDeployed = Boolean(wallet.is_deployed);
    if (params.verifyOnChain !== false) {
      try {
        resolvedDeployed = await isContractDeployed(
          (wallet.chain_id as SupportedChainId) ?? DEFAULT_CHAIN_ID,
          wallet.predicted_address as Address,
        );
      } catch (error) {
        console.warn("[WalletSync] Failed to verify on-chain deployment state", error);
      }
    }

    if (wallet.is_deployed !== resolvedDeployed) {
      try {
        await this.walletService.setDeploymentState(wallet.id, {
          isDeployed: resolvedDeployed,
        });
      } catch (error) {
        console.warn("[WalletSync] Failed to sync deployment metadata", error);
      }
    }

    return this.applyWalletToStores(
      {
        ...wallet,
        is_deployed: resolvedDeployed,
        deployment_tx_hash: resolvedDeployed ? wallet.deployment_tx_hash : null,
        deployment_block_number: resolvedDeployed ? wallet.deployment_block_number : null,
        deployed_at:
          resolvedDeployed
            ? wallet.deployed_at ?? new Date().toISOString()
            : null,
      },
      resolvedDeployed,
    );
  }
}

export default WalletSyncService;
