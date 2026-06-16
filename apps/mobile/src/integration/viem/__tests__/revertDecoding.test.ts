import { decodeFailedOp, decodeRevertString, decodeDelegateAndRevert, decodeBundlerError } from "../revertDecoding";
import { encodeAbiParameters, toHex } from "viem";

function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(`assert failed: ${msg}`); }

function run(): void {
  // Error(string) "AA23 reverted"
  const errStr = ("0x08c379a0" + encodeAbiParameters([{ type: "string" }], ["AA23 reverted"]).slice(2)) as `0x${string}`;
  assert(decodeRevertString(errStr) === "AA23 reverted", "decodeRevertString");

  // FailedOp(uint256,string)
  const failed = ("0x220266b6" + encodeAbiParameters([{ type: "uint256" }, { type: "string" }], [1n, "insufficient funds"]).slice(2)) as `0x${string}`;
  const fo = decodeFailedOp(failed);
  assert(!!fo && fo.opIndex === 1 && fo.reason === "insufficient funds", "decodeFailedOp");

  // DelegateAndRevert(bool,bytes) wrapping Error(string)
  const wrapped = ("0x99410554" + encodeAbiParameters([{ type: "bool" }, { type: "bytes" }], [false, errStr]).slice(2)) as `0x${string}`;
  const d = decodeDelegateAndRevert(wrapped);
  assert(!!d && d.inner === errStr, "decodeDelegateAndRevert");

  // High-level: decodeBundlerError extracts a human reason from a thrown-error shape
  const reason = decodeBundlerError({ cause: { data: errStr } });
  assert(reason === "AA23 reverted", `decodeBundlerError got: ${reason}`);

  console.log("OK", toHex(1).length > 0);
}
run();
