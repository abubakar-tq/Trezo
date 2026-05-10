import { useMemo } from "react";

import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";

export type AccountStatus = "unprovisioned" | "provisioned" | "active";

export type AccountState = {
  status: AccountStatus;
  predictedAddress: string | null;
  isActiveOnChain: (chainId: number) => boolean;
  isProvisioned: boolean;
};

/**
 * Centralises Unprovisioned / Provisioned / Active derivation.
 *
 * States: unprovisioned (no passkey credential bound, address unknown)
 *       → provisioned (passkey bound, address predicted, not deployed on any chain)
 *       → active (smart-account contract deployed on at least one chain).
 *
 * NOTE: v1 treats aaAccount.isDeployed as the proxy for "Active" (PasskeyValidator
 * installation is not separately tracked in the store yet). Update when the
 * deployment pipeline exposes per-module install state.
 */
export function useAccountState(): AccountState {
  // Primitive selectors to keep the useMemo dependency array stable.
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const passkeys = useWalletStore((s) => s.passkeys);
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress);

  return useMemo(() => {
    // A passkey credential being present is the signal that the device has
    // completed the registration ceremony and a counterfactual address has
    // been predicted.
    const isProvisioned = passkeys.length > 0 || aaAccount !== null;

    // Predicted address: prefer the wallet store's aaAccount.predictedAddress
    // (set during the prediction step) and fall back to the user store field.
    const predictedAddress =
      aaAccount?.predictedAddress ?? smartAccountAddress ?? null;

    // The store holds a single aaAccount record per active chain. isDeployed on
    // that record indicates deployment on aaAccount.chainId.
    const deployedChainId =
      aaAccount?.isDeployed === true ? aaAccount.chainId : null;

    const isActiveOnChain = (chainId: number): boolean =>
      deployedChainId !== null && deployedChainId === chainId;

    let status: AccountStatus;
    if (!isProvisioned || predictedAddress === null) {
      status = "unprovisioned";
    } else if (deployedChainId !== null) {
      status = "active";
    } else {
      status = "provisioned";
    }

    return {
      status,
      predictedAddress,
      isActiveOnChain,
      isProvisioned,
    };
  }, [aaAccount, passkeys, smartAccountAddress]);
}
