import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ZkEmailRelayerClient } from "./zk-email-relayer-client.js";
import { installFakeRelayer, type RelayerCall } from "./test-helpers.js";

const baseConfig = {
  baseUrl: "https://relayer.test/api",
  acceptanceTemplateIdx: 0,
  recoveryTemplateIdx: 0,
  proofMode: "per_chain_hosted" as const,
};

let restore: () => void;
let calls: RelayerCall[];

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  restore?.();
});

describe("ZkEmailRelayerClient.sendAcceptanceRequest", () => {
  it("posts snake_case body to <baseUrl>/acceptanceRequest and returns the request id", async () => {
    const fake = installFakeRelayer(() => ({ request_id: "req-1" }));
    restore = fake.restore;
    calls = fake.calls;

    const client = new ZkEmailRelayerClient(baseConfig);
    const ref = await client.sendAcceptanceRequest({
      controllerEthAddr: "0xabc",
      guardianEmailAddr: "g@example.com",
      accountCode: "0xdeadbeef",
      command: "Accept guardian request",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://relayer.test/api/acceptanceRequest");
    expect(calls[0].body).toEqual({
      controller_eth_addr: "0xabc",
      guardian_email_addr: "g@example.com",
      account_code: "0xdeadbeef",
      template_idx: 0,
      command: "Accept guardian request",
    });
    expect(ref).toEqual({ requestId: "req-1", guardianEmail: "g@example.com" });
  });

  it("accepts requestId or id as alternates for request_id", async () => {
    const fake = installFakeRelayer(() => ({ requestId: "req-2" }));
    restore = fake.restore;

    const client = new ZkEmailRelayerClient(baseConfig);
    const ref = await client.sendAcceptanceRequest({
      controllerEthAddr: "0xabc",
      guardianEmailAddr: "g@example.com",
      accountCode: "0xdeadbeef",
      command: "x",
    });
    expect(ref.requestId).toBe("req-2");
  });

  it("throws if upstream omits a request id", async () => {
    const fake = installFakeRelayer(() => ({ error: "boom" }));
    restore = fake.restore;

    const client = new ZkEmailRelayerClient(baseConfig);
    await expect(
      client.sendAcceptanceRequest({
        controllerEthAddr: "0xabc",
        guardianEmailAddr: "g@example.com",
        accountCode: "0xdeadbeef",
        command: "x",
      }),
    ).rejects.toThrow(/request_id/);
  });
});

describe("ZkEmailRelayerClient.completeRequest", () => {
  it("sends controller_eth_addr, account_eth_addr, complete_calldata", async () => {
    const fake = installFakeRelayer(() => ({ success: true, tx_hash: "0xtx" }));
    restore = fake.restore;
    calls = fake.calls;

    const client = new ZkEmailRelayerClient(baseConfig);
    const out = await client.completeRequest({
      controllerEthAddr: "0xC0",
      accountEthAddr: "0xACC",
      completeCalldata: "0xcafe",
    });

    expect(calls[0].body).toEqual({
      controller_eth_addr: "0xC0",
      account_eth_addr: "0xACC",
      complete_calldata: "0xcafe",
    });
    expect(out).toEqual({ success: true, txHash: "0xtx", error: undefined });
  });

  it("returns success=false on fetch failure rather than throwing", async () => {
    const fake = installFakeRelayer(
      () =>
        new Response("boom", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    restore = fake.restore;

    const client = new ZkEmailRelayerClient(baseConfig);
    const out = await client.completeRequest({
      controllerEthAddr: "0xC0",
      accountEthAddr: "0xACC",
      completeCalldata: "0xcafe",
    });
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/500/);
  });
});

describe("ZkEmailRelayerClient.getAccountSalt", () => {
  it("posts {account_code, email_addr}", async () => {
    const fake = installFakeRelayer(() => ({ account_salt: "0xsalt" }));
    restore = fake.restore;
    calls = fake.calls;

    const client = new ZkEmailRelayerClient(baseConfig);
    const salt = await client.getAccountSalt({
      accountCode: "0xcode",
      guardianEmailAddr: "g@example.com",
    });
    expect(calls[0].body).toEqual({
      account_code: "0xcode",
      email_addr: "g@example.com",
    });
    expect(salt).toBe("0xsalt");
  });
});

describe("ZkEmailRelayerClient.getRequestStatus", () => {
  it("normalizes upstream status variants", async () => {
    const client = new ZkEmailRelayerClient(baseConfig);

    const cases: Array<[string, "pending" | "email_sent" | "email_received" | "proof_generated" | "failed"]> = [
      ["EmailSent", "email_sent"],
      ["email_sent", "email_sent"],
      ["EmailReceived", "email_received"],
      ["ProofGenerated", "proof_generated"],
      ["Success", "proof_generated"],
      ["Failed", "failed"],
      ["error", "failed"],
      ["weird-unknown-state", "pending"],
    ];

    for (const [upstream, expected] of cases) {
      const fake = installFakeRelayer(() => ({ status: upstream }));
      restore = fake.restore;
      const out = await client.getRequestStatus("req-x");
      expect(out.status, `mapping ${upstream}`).toBe(expected);
      restore();
    }
  });
});

describe("ZkEmailRelayerClient auth + url normalization", () => {
  it("normalizes a trailing slash on baseUrl", async () => {
    const fake = installFakeRelayer(() => ({ request_id: "r" }));
    restore = fake.restore;
    calls = fake.calls;

    const client = new ZkEmailRelayerClient({ ...baseConfig, baseUrl: "https://relayer.test/api/" });
    await client.sendAcceptanceRequest({
      controllerEthAddr: "0xabc",
      guardianEmailAddr: "g@example.com",
      accountCode: "0xdeadbeef",
      command: "x",
    });
    expect(calls[0].url).toBe("https://relayer.test/api/acceptanceRequest");
  });

  it("sets Authorization: Bearer when apiKey is configured", async () => {
    const seen: Record<string, string> = {};
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: any, init: any) => {
      const h = init?.headers as Record<string, string>;
      Object.assign(seen, h);
      return new Response(JSON.stringify({ request_id: "r" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;
    restore = () => (globalThis.fetch = original);

    const client = new ZkEmailRelayerClient({ ...baseConfig, apiKey: "secret-key" });
    await client.sendAcceptanceRequest({
      controllerEthAddr: "0xabc",
      guardianEmailAddr: "g@example.com",
      accountCode: "0xdeadbeef",
      command: "x",
    });

    expect(seen["Authorization"]).toBe("Bearer secret-key");
  });
});
