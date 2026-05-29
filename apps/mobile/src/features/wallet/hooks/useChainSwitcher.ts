/**
 * useChainSwitcher
 *
 * Drives the in-app "switch active chain" flow. On `switchChain(chainId)`:
 *   1. Resolves the NetworkConfig (rpc + bundler verified).
 *   2. Updates the wallet store's activeChainId + rpcUrl.
 *   3. Re-fetches the user's smart account row for the new chain from Supabase
 *      and pushes it into the store so isActiveOnChain / deploy status track
 *      per-chain truth.
 *
 * Errors surface via the returned `error` state and via an optional onError
 * callback for screen-level toasting.
 */

import { useCallback, useMemo, useState } from "react";

import { useWalletStore } from "@features/wallet/store/useWalletStore";
import WalletPersistenceService from "@features/wallet/services/SupabaseWalletService";
import { useUserStore } from "@store/useUserStore";
import {
  getEnabledNetworks,
  getNetworkConfig,
  resolveNetworkKey,
  type NetworkConfig,
  type NetworkKey,
} from "@/src/integration/networks";
import type { SupportedChainId } from "@/src/integration/chains";

type UseChainSwitcherOptions = {
  /** Called after a successful switch (e.g. for a confirmation toast). */
  onSuccess?: (next: NetworkConfig) => void;
  /** Called on any failure (resolve / fetch / persist). */
  onError?: (message: string) => void;
};

type UseChainSwitcherResult = {
  /** Active chain's NetworkConfig, or undefined if the active chain isn't registered. */
  activeNetwork: NetworkConfig | undefined;
  /** All enabled chains the user can switch between. */
  availableNetworks: NetworkConfig[];
  /** True while a switch is in flight. */
  switching: boolean;
  /** Last error message from a failed switch attempt, cleared on next attempt. */
  error: string | null;
  /** Trigger a switch to the given chainId. No-op when already on that chain. */
  switchChain: (chainId: SupportedChainId | number) => Promise<void>;
};

const walletService = new WalletPersistenceService();

export function useChainSwitcher(options?: UseChainSwitcherOptions): UseChainSwitcherResult {
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const setActiveChain = useWalletStore((s) => s.setActiveChain);
  const setAAAccount = useWalletStore((s) => s.setAAAccount);
  const user = useUserStore((s) => s.user);
  // The global smartAccountAddress/smartAccountDeployed must track the active
  // chain or stale values from previous deploys leak into the new chain's UI.
  const setSmartAccountAddress = useUserStore((s) => s.setSmartAccountAddress);
  const setSmartAccountDeployed = useUserStore((s) => s.setSmartAccountDeployed);

  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableNetworks = useMemo(() => getEnabledNetworks(), []);

  const activeNetwork = useMemo<NetworkConfig | undefined>(() => {
    if (typeof activeChainId !== "number") return undefined;
    try {
      const key = resolveNetworkKey(activeChainId as SupportedChainId);
      return getNetworkConfig(key);
    } catch {
      return undefined;
    }
  }, [activeChainId]);

  const switchChain = useCallback(
    async (chainId: SupportedChainId | number) => {
      if (chainId === activeChainId) {
        return; // no-op
      }
      setSwitching(true);
      setError(null);
      try {
        const key: NetworkKey = resolveNetworkKey(chainId as SupportedChainId);
        const network = getNetworkConfig(key);
        if (!network.isEnabled) {
          throw new Error(`${network.displayName} is not enabled in this build.`);
        }
        if (!network.rpcUrl) {
          throw new Error(`No RPC URL configured for ${network.displayName}.`);
        }

        // Update the active chain first so any reactive UI immediately reflects
        // the new chain; the AA-account fetch then backfills isDeployed state.
        setActiveChain(network.chainId, network.rpcUrl);

        if (user?.id) {
          let wallet = null;
          try {
            wallet = await walletService.getAAWalletForNetwork?.(user.id, network.networkKey);
          } catch {
            // older code path - fall through to chain-id lookup
          }
          if (!wallet) {
            wallet = await walletService.getAAWalletForChain(user.id, network.chainId, network.networkKey);
          }

          if (wallet) {
            setAAAccount({
              id: wallet.id,
              userId: wallet.user_id,
              walletId: wallet.wallet_identity ?? "",
              walletIndex: wallet.wallet_index ?? 0,
              deploymentMode: wallet.deployment_mode,
              predictedAddress: wallet.predicted_address,
              ownerAddress: wallet.owner_address,
              isDeployed: wallet.is_deployed,
              deploymentTxHash: wallet.deployment_tx_hash ?? undefined,
              deploymentBlockNumber: wallet.deployment_block_number ?? undefined,
              walletName: wallet.wallet_name,
              chainId: wallet.chain_id,
              createdAt: wallet.created_at,
              deployedAt: wallet.deployed_at ?? undefined,
            });
            // Sync the global mirror so screens that read smartAccountAddress /
            // smartAccountDeployed directly (HomeScreen.useWalletData,
            // SocialRecoveryService calls, etc.) get this chain's truth, not the
            // last deploy's leaked values.
            setSmartAccountAddress(wallet.predicted_address);
            setSmartAccountDeployed(wallet.is_deployed);
          } else {
            // No wallet record on this chain yet - clear the per-chain record and
            // the global deployment flag so the BalanceCard surfaces a deploy CTA.
            // We leave smartAccountAddress alone: it's the deterministic CREATE2
            // prediction from the current passkey and is the address that WOULD
            // exist on this chain after deploy, which is what we want to display.
            setAAAccount(null);
            setSmartAccountDeployed(false);
          }
        }

        options?.onSuccess?.(network);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to switch chain";
        setError(message);
        options?.onError?.(message);
      } finally {
        setSwitching(false);
      }
    },
    [activeChainId, setActiveChain, setAAAccount, setSmartAccountAddress, setSmartAccountDeployed, user?.id, options],
  );

  return {
    activeNetwork,
    availableNetworks,
    switching,
    error,
    switchChain,
  };
}
