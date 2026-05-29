import { handleRPC, type RPCContext, type RPCMessage } from "../rpcRouter";
import type { DAppSession } from "../../store/useDAppSessionsStore";

// respondToRPC injects exactly: PREFIX + JSON.stringify(payload) + SUFFIX
const PREFIX = 'document.dispatchEvent(new CustomEvent("trezo:rpc-response", { detail: ';
const SUFFIX = " })); true;";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}
function assertEqual(a: unknown, b: unknown, msg: string): void {
  const aj = JSON.stringify(a);
  const bj = JSON.stringify(b);
  if (aj !== bj) throw new Error(`assertEqual failed: ${msg}\n  expected: ${bj}\n  actual:   ${aj}`);
}

type Captured = { result?: unknown; error?: { code: number; message: string } };

const SESSION: DAppSession = {
  id: "s1",
  origin: "https://app.uniswap.org",
  accountAddress: "0xabc0000000000000000000000000000000000001",
  chainId: 84532,
  approvedAt: "t",
  lastUsedAt: "t",
};

function makeCtx(
  overrides: Partial<RPCContext> & { sessionForOrigin?: DAppSession | null } = {},
) {
  const injected: string[] = [];
  const touched: string[] = [];
  const webview = {
    injectJavaScript: (s: string) => {
      injected.push(s);
    },
  } as unknown as RPCContext["webview"];
  const { sessionForOrigin = null, ...ctxOverrides } = overrides;
  const session = sessionForOrigin;
  const ctx: RPCContext = {
    webview,
    origin: "https://app.uniswap.org",
    defaultChainId: 84532,
    findSession: () => session,
    touchSession: (o) => {
      touched.push(o);
    },
    requestApproval: async () => null,
    requestSignMessage: async () => null,
    requestSignTypedData: async () => null,
    requestSendTransaction: async () => null,
    requestSwitchChain: async () => false,
    ...ctxOverrides,
  };
  const decode = (): Captured => {
    const last = injected[injected.length - 1];
    const json = last.slice(PREFIX.length, last.length - SUFFIX.length);
    return JSON.parse(json) as Captured;
  };
  return { ctx, injected, touched, decode };
}

function msg(method: string, params: unknown[] = []): RPCMessage {
  return { type: "rpc", id: "1", method, params };
}

async function run(): Promise<void> {
  // eth_requestAccounts — existing session returns address without prompting
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION });
    await handleRPC(ctx, msg("eth_requestAccounts"));
    assertEqual(decode().result, [SESSION.accountAddress], "requestAccounts returns session address");
  }
  // eth_requestAccounts — no session, approval granted
  {
    const approved = { ...SESSION, id: "s2" };
    const { ctx, decode } = makeCtx({ sessionForOrigin: null, requestApproval: async () => approved });
    await handleRPC(ctx, msg("eth_requestAccounts"));
    assertEqual(decode().result, [approved.accountAddress], "requestAccounts returns approved address");
  }
  // eth_requestAccounts — denied -> 4001
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null, requestApproval: async () => null });
    await handleRPC(ctx, msg("eth_requestAccounts"));
    assertEqual(decode().error?.code, 4001, "denied connect -> 4001");
  }
  // eth_accounts — no session -> []
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null });
    await handleRPC(ctx, msg("eth_accounts"));
    assertEqual(decode().result, [], "eth_accounts empty without session");
  }
  // eth_chainId — falls back to defaultChainId hex when no session (84532 -> 0x14a34)
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null, defaultChainId: 84532 });
    await handleRPC(ctx, msg("eth_chainId"));
    assertEqual(decode().result, "0x14a34", "chainId hex for 84532");
  }
  // personal_sign — unauthorized without session -> 4100
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: null });
    await handleRPC(ctx, msg("personal_sign", ["0xdead"]));
    assertEqual(decode().error?.code, 4100, "personal_sign unauthorized -> 4100");
  }
  // personal_sign — signed -> returns sig, touches session
  {
    const { ctx, decode, touched } = makeCtx({
      sessionForOrigin: SESSION,
      requestSignMessage: async () => "0xsig" as `0x${string}`,
    });
    await handleRPC(ctx, msg("personal_sign", ["0xdead"]));
    assertEqual(decode().result, "0xsig", "personal_sign returns signature");
    assertEqual(touched.length, 1, "personal_sign touches session");
  }
  // eth_signTypedData_v4 — signed -> returns sig
  {
    const { ctx, decode, touched } = makeCtx({
      sessionForOrigin: SESSION,
      requestSignTypedData: async () => "0xtyped" as `0x${string}`,
    });
    await handleRPC(ctx, msg("eth_signTypedData_v4", ["0xaddr", "{}"]));
    assertEqual(decode().result, "0xtyped", "signTypedData returns signature");
    assertEqual(touched.length, 1, "signTypedData touches session");
  }
  // eth_sendTransaction — signed -> returns userOpHash
  {
    const { ctx, decode } = makeCtx({
      sessionForOrigin: SESSION,
      requestSendTransaction: async () => "0xuserop" as `0x${string}`,
    });
    await handleRPC(ctx, msg("eth_sendTransaction", [{ to: "0x01" }]));
    assertEqual(decode().result, "0xuserop", "sendTransaction returns userOpHash");
  }
  // wallet_switchEthereumChain — ok -> null
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION, requestSwitchChain: async () => true });
    await handleRPC(ctx, msg("wallet_switchEthereumChain", [{ chainId: "0x14a34" }]));
    assertEqual(decode().result, null, "switchChain ok -> null");
  }
  // wallet_switchEthereumChain — rejected -> 4902
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION, requestSwitchChain: async () => false });
    await handleRPC(ctx, msg("wallet_switchEthereumChain", [{ chainId: "0x1" }]));
    assertEqual(decode().error?.code, 4902, "switchChain rejected -> 4902");
  }
  // handler throws -> -32603 (internal error catch path)
  {
    const { ctx, decode } = makeCtx({
      sessionForOrigin: SESSION,
      requestSignMessage: async () => {
        throw new Error("boom");
      },
    });
    await handleRPC(ctx, msg("personal_sign", ["0xdead"]));
    assert(decode().error?.code === -32603, "handler throw -> -32603");
  }
  // unknown method (incl. wallet_addEthereumChain) -> -32601
  {
    const { ctx, decode } = makeCtx({ sessionForOrigin: SESSION });
    await handleRPC(ctx, msg("wallet_addEthereumChain", [{}]));
    assertEqual(decode().error?.code, -32601, "addEthereumChain unsupported -> -32601");
  }
  console.log("OK rpcRouter");
}

run()
  .then(() => {})
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
