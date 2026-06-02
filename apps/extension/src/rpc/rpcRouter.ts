// Chain-aware RPC router.
// - Resolves the chain from the existing session, falling back to the user's active chain.
// - All approvals are delegated to the popup via requestApproval().
// - wallet_switchEthereumChain updates both the active chain and the origin session,
//   then emits a chainChanged event to connected tabs.

import type { RpcResponseMsg } from "../types/messages";
import { sessionStore } from "./sessionStore";
import { requestApproval } from "./approvalManager";
import { WalletResolver } from "../pairing/walletResolver";
import { AuthService } from "../auth/authService";
import { getActiveChainId, setActiveChainId } from "../core/activeChain";
import { isEnabledChain, type ExtChainId } from "../core/networks";

const _connectingOrigins = new Set<string>();

const rid = () => crypto.randomUUID().replace(/-/g, '');
const ok = (id: string, result: unknown): RpcResponseMsg => ({ type: "trezo-rpc-response", id, result });
const fail = (id: string, code: number, message: string): RpcResponseMsg => ({ type: "trezo-rpc-response", id, error: { code, message } });

/**
 * Emit a provider event (e.g. chainChanged / accountsChanged) to all tabs
 * whose origin matches the given origin.
 */
async function emitToOrigin(origin: string, event: string, data: unknown): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: `${origin}/*` });
    for (const t of tabs) {
      if (t.id) {
        chrome.tabs.sendMessage(t.id, { type: "trezo-event", event, data }).catch(() => {});
      }
    }
  } catch {
    // tabs API may be unavailable in some contexts; swallow silently
  }
}

export async function handleRpc(
  id: string,
  method: string,
  params: unknown[],
  origin: string,
): Promise<RpcResponseMsg> {
  try {
    // Resolve session + active chain INSIDE the try so a transient chrome.storage
    // rejection surfaces as a returned -32603 error rather than an unhandled
    // service-worker rejection (which would leave sendResponse never called).
    const session = origin ? await sessionStore.get(origin) : null;
    // The "current chain" is the session chain (if connected) or the active chain.
    const chainId: number = session?.chainId ?? (await getActiveChainId());

    switch (method) {
      // ── Read-only chain / account info ────────────────────────────────────
      case "eth_chainId":
        return ok(id, `0x${chainId.toString(16)}`);

      case "net_version":
        return ok(id, String(chainId));

      case "eth_accounts":
        return ok(id, session ? [session.address] : []);

      // ── Connect ────────────────────────────────────────────────────────────
      case "eth_requestAccounts": {
        if (session) return ok(id, [session.address]);

        if (_connectingOrigins.has(origin)) {
          return fail(id, -32002, "Request already pending. Check the Trezo approval window.");
        }
        _connectingOrigins.add(origin);
        try {
          const user = await AuthService.getUser();
          if (!user) return fail(id, 4100, "Extension not logged in. Open Trezo to sign in.");

          const wallet = await WalletResolver.getForChain(user.id, chainId);
          if (!wallet) return fail(id, 4100, "No account on this chain. Open Trezo to set it up.");

          // Open the popup for user approval
          const approved = await requestApproval({ kind: "connect", id: rid(), origin, chainId });
          if (!approved) return fail(id, 4001, "User rejected");

          // Persist the session
          await sessionStore.set({ origin, address: wallet.address, chainId, approvedAt: Date.now() });
          // Notify the page — emit accountsChanged + connect + chainChanged per EIP-1193
          await emitToOrigin(origin, "accountsChanged", [wallet.address]);
          await emitToOrigin(origin, "connect", { chainId: `0x${chainId.toString(16)}` });
          await emitToOrigin(origin, "chainChanged", `0x${chainId.toString(16)}`);
          return ok(id, [wallet.address]);
        } finally {
          _connectingOrigins.delete(origin);
        }
      }

      // ── personal_sign ─────────────────────────────────────────────────────
      case "personal_sign": {
        if (!session) return fail(id, 4100, "Unauthorized. Connect first.");
        // Normalise param order: spec is [message, address] but some legacy dApps
        // send [address, message]. Detect by checking if params[0] is a 20-byte address.
        const [p0, p1] = params as [string, string];
        const isAddressFirst = /^0x[0-9a-fA-F]{40}$/.test(p0);
        const hexMessage = (isAddressFirst ? p1 : p0) as `0x${string}`;
        const sig = await requestApproval({
          kind: "sign",
          id: rid(),
          origin,
          chainId: session.chainId,
          message: hexMessage,
        });
        if (!sig) return fail(id, 4001, "User rejected");
        return ok(id, sig);
      }

      // ── eth_signTypedData_v4 ───────────────────────────────────────────────
      case "eth_signTypedData_v4": {
        if (!session) return fail(id, 4100, "Unauthorized. Connect first.");
        const [, typedDataRaw] = params as [string, unknown];
        const typedData = typeof typedDataRaw === "string" ? JSON.parse(typedDataRaw) : typedDataRaw;
        const sig = await requestApproval({
          kind: "signTyped",
          id: rid(),
          origin,
          chainId: session.chainId,
          typedData,
        });
        if (!sig) return fail(id, 4001, "User rejected");
        return ok(id, sig);
      }

      // ── eth_sendTransaction (Milestone 6 — sheet not yet present, queue it) ─
      case "eth_sendTransaction": {
        if (!session) return fail(id, 4100, "Unauthorized. Connect first.");
        const [tx] = params as [{ to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` }];
        const hash = await requestApproval({
          kind: "tx",
          id: rid(),
          origin,
          chainId: session.chainId,
          tx,
        });
        if (!hash) return fail(id, 4001, "User rejected");
        return ok(id, hash);
      }

      // ── wallet_switchEthereumChain ─────────────────────────────────────────
      case "wallet_switchEthereumChain": {
        if (!session) return fail(id, 4100, "Unauthorized. Connect first.");
        const [{ chainId: targetHex }] = params as [{ chainId: string }];
        const target = parseInt(targetHex, 16);
        if (!isEnabledChain(target)) {
          return fail(id, 4902, `Chain ${targetHex} is not supported by Trezo. Add it on your phone first.`);
        }
        // Update active chain
        await setActiveChainId(target as ExtChainId);
        // Update the origin session if one exists
        if (session) {
          await sessionStore.set({ ...session, chainId: target });
        }
        // Emit chainChanged to the page
        await emitToOrigin(origin, "chainChanged", `0x${target.toString(16)}`);
        return ok(id, null);
      }

      // ── wallet_requestPermissions / wallet_getPermissions ─────────────────
      case "wallet_requestPermissions": {
        if (session) return ok(id, [{ parentCapability: "eth_accounts" }]);
        const r = await handleRpc(rid(), "eth_requestAccounts", [], origin);
        if (r.error) return fail(id, r.error.code, r.error.message);
        return ok(id, [{ parentCapability: "eth_accounts" }]);
      }
      case "wallet_getPermissions": {
        return ok(id, session ? [{ parentCapability: "eth_accounts" }] : []);
      }

      // ── Read-only RPC passthrough ─────────────────────────────────────────
      // dApps call these before/without a connected session; forward to the
      // chain's public RPC so they don't break on unsupported-method errors.
      case "eth_getBalance":
      case "eth_call":
      case "eth_blockNumber":
      case "eth_getTransactionCount":
      case "eth_getTransactionReceipt":
      case "eth_getTransactionByHash":
      case "eth_gasPrice":
      case "eth_estimateGas":
      case "eth_getLogs":
      case "eth_getCode": {
        const { getPublicClient } = await import("../core/clients");
        const publicClient = getPublicClient(chainId);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await (publicClient as any).request({ method, params });
          return ok(id, result);
        } catch (e) {
          return fail(id, -32603, e instanceof Error ? e.message : "RPC error");
        }
      }

      default:
        return fail(id, -32601, `Method not supported: ${method}`);
    }
  } catch (e) {
    return fail(id, -32603, e instanceof Error ? e.message : "Internal error");
  }
}
