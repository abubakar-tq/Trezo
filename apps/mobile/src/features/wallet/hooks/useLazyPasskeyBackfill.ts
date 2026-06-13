import { useEffect, useRef } from "react";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { SupabaseWalletService } from "@/src/features/wallet/services/SupabaseWalletService";
import { useUserStore } from "@/src/store/useUserStore";

/**
 * One-shot backfill: if the user has a local passkey AND a deployed AA wallet
 * but the passkeys table has no row for that credential, sync it.
 *
 * Non-fatal in all paths.
 */
export const useLazyPasskeyBackfill = (): void => {
  const user = useUserStore((s) => s.user);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const smartAccountDeployed = useUserStore((s) => s.smartAccountDeployed);
  const ranRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user?.id || !smartAccountDeployed) return;
    if (ranRef.current === user.id) return;

    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        const local = await PasskeyService.getPasskey(user.id);
        if (cancelled || !local?.credentialId) return;

        const cloud = await PasskeyService.fetchCloudPasskeys(user.id);
        if (cancelled) return;
        if (cloud.some((c) => c.credentialId === local.credentialId)) {
          ranRef.current = user.id;
          return;
        }

        const walletService = new SupabaseWalletService();
        const wallet = await walletService.getAAWallet(user.id);
        if (cancelled || !wallet?.id) return;

        await PasskeyService.syncPasskeyToCloud(user.id, wallet.id, {
          credentialId: local.credentialId,
          credentialIdRaw: local.credentialIdRaw ?? "0x",
          publicKeyX: local.publicKeyX ?? "0x",
          publicKeyY: local.publicKeyY ?? "0x",
          deviceName: local.deviceName,
          deviceType: local.deviceType,
          createdAt: local.createdAt ?? new Date().toISOString(),
          rpId: local.rpId ?? "",
        });
        ranRef.current = user.id;
      } catch (err) {
        console.warn("[useLazyPasskeyBackfill] failed (non-fatal):", err);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id, smartAccountDeployed]);
};
