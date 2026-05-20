/**
 * usePasskeyAuthority
 *
 * Cross-screen source of truth for "is this device's local passkey actually
 * authoritative on the smart account?". Returns a status object the UI can
 * use to (a) color the security shield honestly, (b) gate any flow that
 * builds a UserOp (sign, approve, send), and (c) prompt for recovery when
 * the local passkey is stale relative to on-chain state.
 *
 * Why a dedicated hook: relying only on `hasLocalPasskey` (the existing
 * useAccountManagement field) caused the UI to show "fully secured" in
 * states where the local credential was different from the on-chain
 * PasskeyValidator's registered credential — so the user could tap Send /
 * Approve / Sign and have the UserOp rejected by the validator with a
 * confusing RPC error blob.
 */
import { useCallback, useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import PasskeyService from "../services/PasskeyService";
import { getDeployment, getPublicClient } from "@/src/integration/viem";
import { ABIS } from "@/src/integration/viem/abis";
import type { SupportedChainId } from "@/src/integration/chains";

export type PasskeyAuthorityStatus =
  | "loading"
  | "no_local" // no local passkey on this device
  | "wallet_undeployed" // smart account not yet deployed on this chain
  | "not_registered" // local passkey exists but PasskeyValidator doesn't know it
  | "stale_keys" // credentialId registered but px/py differ (data corruption)
  | "authoritative" // ✅ local passkey can sign UserOps
  | "error";

export type PasskeyAuthority = {
  status: PasskeyAuthorityStatus;
  loading: boolean;
  error: string | null;
  hasLocalPasskey: boolean;
  onChainPasskeyCount: bigint;
  isAuthoritative: boolean; // shortcut: status === "authoritative"
  /** Force a fresh on-chain re-read. */
  refresh: () => void;
};

const DEFAULT: PasskeyAuthority = {
  status: "loading",
  loading: true,
  error: null,
  hasLocalPasskey: false,
  onChainPasskeyCount: 0n,
  isAuthoritative: false,
  refresh: () => {},
};

export function usePasskeyAuthority(params: {
  userId: string | null | undefined;
  smartAccountAddress: Address | null | undefined;
  chainId: SupportedChainId | null | undefined;
}): PasskeyAuthority {
  const { userId, smartAccountAddress, chainId } = params;
  const [state, setState] = useState<Omit<PasskeyAuthority, "refresh">>(DEFAULT);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId || !smartAccountAddress || !chainId) {
      setState({
        status: "loading",
        loading: false,
        error: null,
        hasLocalPasskey: false,
        onChainPasskeyCount: 0n,
        isAuthoritative: false,
      });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    // Hard timeout — if any of the on-chain reads hang (e.g., slow RPC, network
    // hiccup), settle to an "error" state after 15s so the UI is never stuck
    // showing the indefinite "Checking…" placeholder.
    const HOOK_TIMEOUT_MS = 15_000;
    const timeoutHandle = setTimeout(() => {
      if (cancelled) return;
      setState({
        status: "error",
        loading: false,
        error: `Timed out after ${HOOK_TIMEOUT_MS / 1000}s reading on-chain state`,
        hasLocalPasskey: false,
        onChainPasskeyCount: 0n,
        isAuthoritative: false,
      });
      cancelled = true;
    }, HOOK_TIMEOUT_MS);

    (async () => {
      try {
        // 1. Read the local passkey for this user.
        const local = await PasskeyService.getPasskey(userId);
        if (cancelled) return;

        if (!local) {
          setState({
            status: "no_local",
            loading: false,
            error: null,
            hasLocalPasskey: false,
            onChainPasskeyCount: 0n,
            isAuthoritative: false,
          });
          return;
        }

        // 2. Read PasskeyValidator state on-chain.
        const deployment = getDeployment(chainId);
        const validatorAddr = deployment?.passkeyValidator as Address | undefined;
        if (!validatorAddr) {
          throw new Error(`No PasskeyValidator address in deployment for chain ${chainId}`);
        }

        const client = getPublicClient(chainId);
        const bytecode = await client.getBytecode({ address: smartAccountAddress });
        if (!bytecode || bytecode === "0x") {
          setState({
            status: "wallet_undeployed",
            loading: false,
            error: null,
            hasLocalPasskey: true,
            onChainPasskeyCount: 0n,
            isAuthoritative: false,
          });
          return;
        }

        const credentialIdRaw = local.credentialIdRaw as Hex;
        const [count, hasIt] = await Promise.all([
          client
            .readContract({
              address: validatorAddr,
              abi: ABIS.passkeyValidator,
              functionName: "passkeyCount",
              args: [smartAccountAddress],
            })
            .catch(() => 0n) as Promise<bigint>,
          client
            .readContract({
              address: validatorAddr,
              abi: ABIS.passkeyValidator,
              functionName: "hasPasskey",
              args: [smartAccountAddress, credentialIdRaw],
            })
            .catch(() => false) as Promise<boolean>,
        ]);

        if (cancelled) return;

        if (!hasIt) {
          setState({
            status: "not_registered",
            loading: false,
            error: null,
            hasLocalPasskey: true,
            onChainPasskeyCount: count,
            isAuthoritative: false,
          });
          return;
        }

        // 3. credentialId is registered; verify px/py match.
        // PasskeyValidator.getPasskeyRecord returns (px, py, signCounter, counterInitialized)
        // — 4 outputs, NOT 5. Don't include an `id` field; the contract doesn't return one.
        let pxMatch = true;
        let pyMatch = true;
        try {
          const record = (await client.readContract({
            address: validatorAddr,
            abi: ABIS.passkeyValidator,
            functionName: "getPasskeyRecord",
            args: [smartAccountAddress, credentialIdRaw],
          })) as readonly [bigint, bigint, number, boolean];
          const [onchainPx, onchainPy] = record;
          pxMatch = BigInt(local.publicKeyX ?? "0x0") === onchainPx;
          pyMatch = BigInt(local.publicKeyY ?? "0x0") === onchainPy;
        } catch {
          // If the record read fails after hasPasskey succeeded, treat as authoritative;
          // signing will surface the real issue.
        }

        if (cancelled) return;

        if (!pxMatch || !pyMatch) {
          setState({
            status: "stale_keys",
            loading: false,
            error: null,
            hasLocalPasskey: true,
            onChainPasskeyCount: count,
            isAuthoritative: false,
          });
          return;
        }

        setState({
          status: "authoritative",
          loading: false,
          error: null,
          hasLocalPasskey: true,
          onChainPasskeyCount: count,
          isAuthoritative: true,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[usePasskeyAuthority] check failed:", message);
        setState({
          status: "error",
          loading: false,
          error: message,
          hasLocalPasskey: false,
          onChainPasskeyCount: 0n,
          isAuthoritative: false,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutHandle);
    };
  }, [userId, smartAccountAddress, chainId, refreshTick]);

  return { ...state, refresh };
}

/**
 * Pretty-print the status for an Alert / banner.
 */
export function describePasskeyAuthority(status: PasskeyAuthorityStatus): {
  title: string;
  body: string;
  severity: "ok" | "warn" | "error" | "info";
} {
  switch (status) {
    case "loading":
      return { title: "Checking…", body: "Reading on-chain state.", severity: "info" };
    case "no_local":
      return {
        title: "No passkey on this device",
        body: "This device cannot sign anything for the wallet until a passkey is provisioned or recovered.",
        severity: "warn",
      };
    case "wallet_undeployed":
      return {
        title: "Wallet not deployed",
        body: "The smart account isn't deployed on this chain yet. Sign-in actions will use deployment first.",
        severity: "warn",
      };
    case "not_registered":
      return {
        title: "Local passkey not registered on-chain",
        body: "This device has a passkey, but the wallet's on-chain validator does not recognize it. UserOps signed with this passkey will be rejected. Run guardian recovery to register the current passkey.",
        severity: "error",
      };
    case "stale_keys":
      return {
        title: "Public key mismatch",
        body: "credentialId is registered but stored public-key bytes do not match. Data may be corrupted — re-provision or recover.",
        severity: "error",
      };
    case "authoritative":
      return {
        title: "Passkey authoritative",
        body: "Your local passkey is registered on-chain and can sign UserOps for this wallet.",
        severity: "ok",
      };
    case "error":
      return {
        title: "Could not verify",
        body: "On-chain read failed. Pull to refresh or check network.",
        severity: "warn",
      };
  }
}
