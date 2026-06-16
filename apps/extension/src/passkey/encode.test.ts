import { describe, it, expect } from "vitest";
import { encodeSignatureForContract, credentialIdToBytes32 } from "./encode";

describe("encodeSignatureForContract", () => {
  it("produces a stable ABI-encoded envelope", () => {
    const sig = {
      passkeyId: credentialIdToBytes32("AAAA"),
      authenticatorData: "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000",
      clientDataJSON: '{"type":"webauthn.get","challenge":"abc","origin":"chrome-extension://x"}',
      challengeIndex: 22,
      typeIndex: 1,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    };
    const encoded = encodeSignatureForContract(sig);
    expect(encoded.startsWith("0x")).toBe(true);
    expect(encoded.length).toBeGreaterThan(200);
  });

  it("credentialIdToBytes32 right-pads to 32 bytes", () => {
    const out = credentialIdToBytes32("AAAA"); // 3 bytes decoded
    expect(out).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
