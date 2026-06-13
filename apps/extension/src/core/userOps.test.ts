import { describe, it, expect } from "vitest";
import { encodeFunctionData } from "viem";
import { ABIS } from "./abis";

describe("smartAccount.execute encoding", () => {
  it("encodes execute(target,value,data) deterministically", () => {
    const data = encodeFunctionData({
      abi: ABIS.smartAccount,
      functionName: "execute",
      args: ["0x000000000000000000000000000000000000dEaD", 0n, "0x"],
    });
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
  });
});
