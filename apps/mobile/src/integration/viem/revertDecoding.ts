import { decodeAbiParameters, type Hex } from "viem";

const FAILED_OP_SELECTOR = "0x220266b6";
const DELEGATE_AND_REVERT_SELECTOR = "0x99410554";
const ERROR_STRING_SELECTOR = "0x08c379a0";

export const asHex = (v: any): Hex | undefined =>
  typeof v === "string" && v.startsWith("0x") ? (v as Hex) : undefined;

export const collectErrorData = (err: any): Hex[] => {
  const out: Hex[] = [];
  const push = (v: any) => { const h = asHex(v); if (h) out.push(h); };
  push(err?.data); push(err?.error?.data); push(err?.cause?.data); push(err?.cause?.error?.data);
  push(err?.cause?.cause?.data);
  try { const body = JSON.parse(err?.body); push(body?.error?.data); } catch { /* noop */ }
  return out;
};

export const decodeDelegateAndRevert = (raw: Hex): { ok: boolean; inner: Hex } | null => {
  if (!raw.startsWith(DELEGATE_AND_REVERT_SELECTOR) || raw.length < 10) return null;
  try {
    const data = ("0x" + raw.slice(10)) as Hex;
    const [ok, inner] = decodeAbiParameters([{ type: "bool" }, { type: "bytes" }], data);
    return { ok: ok as boolean, inner: inner as Hex };
  } catch { return null; }
};

export const decodeFailedOp = (raw: Hex): { opIndex: number; reason: string } | null => {
  if (!raw.startsWith(FAILED_OP_SELECTOR) || raw.length < 10) return null;
  try {
    const data = ("0x" + raw.slice(10)) as Hex;
    const [opIndex, reason] = decodeAbiParameters([{ type: "uint256" }, { type: "string" }], data);
    return { opIndex: Number(opIndex), reason: reason as string };
  } catch { return null; }
};

export const decodeRevertString = (raw: Hex): string | null => {
  if (!raw.startsWith(ERROR_STRING_SELECTOR) || raw.length < 10) return null;
  try {
    const data = ("0x" + raw.slice(10)) as Hex;
    const [reason] = decodeAbiParameters([{ type: "string" }], data);
    return reason as string;
  } catch { return null; }
};

/** Best-effort human-readable reason from any thrown bundler/RPC/eth_call error. */
export const decodeBundlerError = (err: any): string | null => {
  for (const raw of collectErrorData(err)) {
    const delegated = decodeDelegateAndRevert(raw);
    const candidate = delegated ? delegated.inner : raw;
    const failed = decodeFailedOp(candidate);
    if (failed) return failed.reason;
    const revertStr = decodeRevertString(candidate);
    if (revertStr) return revertStr;
  }
  if (typeof err?.shortMessage === "string") return err.shortMessage;
  if (typeof err?.message === "string") return err.message.split("\n")[0];
  return null;
};
