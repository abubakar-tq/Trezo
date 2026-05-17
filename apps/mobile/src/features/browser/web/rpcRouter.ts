import type WebView from "react-native-webview";
import { respondToRPC } from "./injectedProvider";
import { useDAppSessionsStore } from "@features/browser/store/useDAppSessionsStore";
import type { DAppSession } from "@features/browser/store/useDAppSessionsStore";
import { DEFAULT_CHAIN_ID } from "@/src/integration/chains";

export type RPCContext = {
  webview: WebView | null;
  origin: string;
  requestApproval: (origin: string, chainId: number) => Promise<DAppSession | null>;
  requestSignMessage: (origin: string, hexMessage: string) => Promise<`0x${string}` | null>;
  requestSignTypedData: (origin: string, typedData: unknown) => Promise<`0x${string}` | null>;
  requestSendTransaction: (
    origin: string,
    tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` },
  ) => Promise<`0x${string}` | null>;
  requestSwitchChain: (origin: string, chainId: number) => Promise<boolean>;
};

export type RPCMessage = {
  type: "rpc";
  id: string;
  method: string;
  params: unknown[];
};

export async function handleRPC(ctx: RPCContext, msg: RPCMessage): Promise<void> {
  const { webview, origin } = ctx;
  const store = useDAppSessionsStore.getState();
  const session = store.findSession(origin);

  try {
    switch (msg.method) {
      case "eth_requestAccounts": {
        if (session) {
          respondToRPC(webview, msg.id, [session.accountAddress]);
          return;
        }
        const approved = await ctx.requestApproval(origin, DEFAULT_CHAIN_ID);
        if (!approved) {
          respondToRPC(webview, msg.id, undefined, { code: 4001, message: "User rejected" });
          return;
        }
        respondToRPC(webview, msg.id, [approved.accountAddress]);
        return;
      }

      case "eth_accounts": {
        respondToRPC(webview, msg.id, session ? [session.accountAddress] : []);
        return;
      }

      case "eth_chainId": {
        respondToRPC(
          webview,
          msg.id,
          `0x${(session?.chainId ?? DEFAULT_CHAIN_ID).toString(16)}`,
        );
        return;
      }

      case "personal_sign": {
        if (!session) {
          respondToRPC(webview, msg.id, undefined, { code: 4100, message: "Unauthorized" });
          return;
        }
        const [hexMessage] = msg.params as [`0x${string}`];
        const sig = await ctx.requestSignMessage(origin, hexMessage);
        if (!sig) {
          respondToRPC(webview, msg.id, undefined, { code: 4001, message: "User rejected" });
          return;
        }
        store.touchSession(origin);
        respondToRPC(webview, msg.id, sig);
        return;
      }

      case "eth_signTypedData_v4": {
        if (!session) {
          respondToRPC(webview, msg.id, undefined, { code: 4100, message: "Unauthorized" });
          return;
        }
        const [, typedDataRaw] = msg.params as [string, unknown];
        const parsed =
          typeof typedDataRaw === "string" ? JSON.parse(typedDataRaw) : typedDataRaw;
        const sig = await ctx.requestSignTypedData(origin, parsed);
        if (!sig) {
          respondToRPC(webview, msg.id, undefined, { code: 4001, message: "User rejected" });
          return;
        }
        store.touchSession(origin);
        respondToRPC(webview, msg.id, sig);
        return;
      }

      case "eth_sendTransaction": {
        if (!session) {
          respondToRPC(webview, msg.id, undefined, { code: 4100, message: "Unauthorized" });
          return;
        }
        const [tx] = msg.params as [
          { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` },
        ];
        const hash = await ctx.requestSendTransaction(origin, tx);
        if (!hash) {
          respondToRPC(webview, msg.id, undefined, { code: 4001, message: "User rejected" });
          return;
        }
        store.touchSession(origin);
        respondToRPC(webview, msg.id, hash);
        return;
      }

      case "wallet_switchEthereumChain": {
        const [{ chainId: chainIdHex }] = msg.params as [{ chainId: string }];
        const targetChainId = parseInt(chainIdHex, 16);
        const ok = await ctx.requestSwitchChain(origin, targetChainId);
        if (!ok) {
          respondToRPC(webview, msg.id, undefined, {
            code: 4902,
            message: "Unrecognized chain or user rejected",
          });
          return;
        }
        respondToRPC(webview, msg.id, null);
        return;
      }

      default: {
        respondToRPC(webview, msg.id, undefined, {
          code: -32601,
          message: `Method not supported: ${msg.method}`,
        });
        return;
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    respondToRPC(webview, msg.id, undefined, { code: -32603, message });
  }
}
