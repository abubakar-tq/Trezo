import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { makeFakeStore, installFakeRelayer, type RelayerCall } from "./test-helpers.js";

const baseConfig = {
  baseUrl: "https://relayer.test/api",
  acceptanceTemplateIdx: 0,
  recoveryTemplateIdx: 0,
  proofMode: "per_chain_hosted" as const,
};

const ADDR = "0x" + "a".repeat(40);
const ACCOUNT_CODE = "0x" + "b".repeat(64);
const UUID = "11111111-1111-1111-1111-111111111111";

let restore: () => void;

afterEach(() => {
  restore?.();
});

describe("GET /health", () => {
  it("reports relayer + proofMode", async () => {
    const app = createApp({ store: makeFakeStore(), relayerConfig: baseConfig });
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      relayer: baseConfig.baseUrl,
      proofMode: "per_chain_hosted",
    });
  });
});

describe("POST /zk-email/acceptance-request", () => {
  it("400 on bad payload", async () => {
    const app = createApp({ store: makeFakeStore(), relayerConfig: baseConfig });
    const res = await request(app).post("/zk-email/acceptance-request").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });

  it("200 on success, forwards to relayer", async () => {
    const fake = installFakeRelayer(() => ({ request_id: "req-acc-1" }));
    restore = fake.restore;
    const app = createApp({ store: makeFakeStore(), relayerConfig: baseConfig });

    const res = await request(app)
      .post("/zk-email/acceptance-request")
      .send({
        controllerEthAddr: ADDR,
        guardianEmailAddr: "g@example.com",
        accountCode: ACCOUNT_CODE,
        command: "Accept guardian request",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      requestId: "req-acc-1",
      guardianEmail: "g@example.com",
    });
    expect(fake.calls[0].body.template_idx).toBe(0);
  });

  it("502 when the upstream relayer errors", async () => {
    const fake = installFakeRelayer(
      () =>
        new Response("relayer exploded", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    restore = fake.restore;
    const app = createApp({ store: makeFakeStore(), relayerConfig: baseConfig });

    const res = await request(app)
      .post("/zk-email/acceptance-request")
      .send({
        controllerEthAddr: ADDR,
        guardianEmailAddr: "g@example.com",
        accountCode: ACCOUNT_CODE,
        command: "x",
      });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/500|relayer/i);
  });
});

describe("POST /zk-email/account-salt", () => {
  it("returns accountSalt from upstream", async () => {
    const fake = installFakeRelayer(() => ({ account_salt: "0xsalt-value" }));
    restore = fake.restore;
    const app = createApp({ store: makeFakeStore(), relayerConfig: baseConfig });

    const res = await request(app)
      .post("/zk-email/account-salt")
      .send({ accountCode: ACCOUNT_CODE, guardianEmailAddr: "g@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, accountSalt: "0xsalt-value" });
  });
});

describe("POST /send-group-recovery-requests", () => {
  it("404 when group not found", async () => {
    const app = createApp({ store: makeFakeStore(), relayerConfig: baseConfig });
    const res = await request(app)
      .post("/send-group-recovery-requests")
      .send({ groupId: UUID });
    expect(res.status).toBe(404);
  });

  it("409 when group is in a non-sendable status", async () => {
    const groups = new Map([[UUID, { id: UUID, config_id: "cfg-1", status: "executed", smart_account_address: ADDR, multichain_recovery_data_hash: "0xhash" }]]);
    const app = createApp({
      store: makeFakeStore({ groups }),
      relayerConfig: baseConfig,
    });
    const res = await request(app)
      .post("/send-group-recovery-requests")
      .send({ groupId: UUID });
    expect(res.status).toBe(409);
  });

  it("sends one relayer request per chain in per_chain_hosted mode", async () => {
    const fake = installFakeRelayer((call: RelayerCall) => ({
      request_id: `req-${call.body.controller_eth_addr.slice(-4)}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    restore = fake.restore;

    const groups = new Map([
      [UUID, {
        id: UUID,
        config_id: "cfg-1",
        status: "collecting_approvals",
        smart_account_address: ADDR,
        multichain_recovery_data_hash: "0xHASH",
      }],
    ]);
    const configs = new Map([["cfg-1", { id: "cfg-1", threshold: 1, security_mode: "standard" }]]);
    const guardians = new Map([
      ["cfg-1", [{ email_hash: "h1", normalized_email_encrypted: "plain-v1:g1@example.com", masked_email: "g***@example.com", weight: 1 }]],
    ]);
    const approvals = new Map([
      [UUID, [{ id: "app-1", group_id: UUID, guardian_email_hash: "h1", masked_email: null, relayer_request_id: null, status: "pending", last_error: null }]],
    ]);
    const chainRequests = new Map([
      [UUID, [
        { id: "cr-1", group_id: UUID, chain_id: 84532, status: "pending" },
        { id: "cr-2", group_id: UUID, chain_id: 31337, status: "pending" },
      ]],
    ]);

    const app = createApp({
      store: makeFakeStore({ groups, configs, guardians, approvals, chainRequests }),
      relayerConfig: baseConfig,
    });

    const res = await request(app)
      .post("/send-group-recovery-requests")
      .send({ groupId: UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fake.calls).toHaveLength(2); // one per chain
    expect(res.body.results[0].sent).toBe(true);
    expect(res.body.results[0].relayerRequestIds).toHaveLength(2);

    // Command was constructed with lowercased addr + hash
    const sentCommand = fake.calls[0].body.command as string;
    expect(sentCommand).toContain(ADDR.toLowerCase());
    expect(sentCommand).toContain("0xhash"); // lowercased
  });

  it("marks vault-encrypted guardian emails as failed and does not call relayer", async () => {
    const fake = installFakeRelayer(() => ({ request_id: "should-not-be-called" }));
    restore = fake.restore;

    const groups = new Map([
      [UUID, {
        id: UUID,
        config_id: "cfg-1",
        status: "collecting_approvals",
        smart_account_address: ADDR,
        multichain_recovery_data_hash: "0xhash",
      }],
    ]);
    const configs = new Map([["cfg-1", { id: "cfg-1", threshold: 1, security_mode: "extra" }]]);
    const guardians = new Map([
      ["cfg-1", [{ email_hash: "h1", normalized_email_encrypted: "vaultv1:OPAQUE", masked_email: "g***", weight: 1 }]],
    ]);
    const approvals = new Map([
      [UUID, [{ id: "app-1", group_id: UUID, guardian_email_hash: "h1", masked_email: null, relayer_request_id: null, status: "pending", last_error: null }]],
    ]);
    const chainRequests = new Map([
      [UUID, [{ id: "cr-1", group_id: UUID, chain_id: 84532, status: "pending" }]],
    ]);

    const app = createApp({
      store: makeFakeStore({ groups, configs, guardians, approvals, chainRequests }),
      relayerConfig: baseConfig,
    });

    const res = await request(app)
      .post("/send-group-recovery-requests")
      .send({ groupId: UUID });

    expect(res.status).toBe(200);
    expect(fake.calls).toHaveLength(0);
    expect(res.body.results[0].sent).toBe(false);
    expect(res.body.results[0].error).toMatch(/vault key|locked/i);
  });
});

describe("POST /poll-group-status", () => {
  it("advances submission status when relayer reports proof_generated", async () => {
    const fake = installFakeRelayer(() => ({ status: "ProofGenerated", email_auth_msg: { foo: "bar" } }));
    restore = fake.restore;

    const groups = new Map([
      [UUID, { id: UUID, config_id: "cfg-1", status: "collecting_approvals", smart_account_address: ADDR, multichain_recovery_data_hash: "0xhash" }],
    ]);
    const configs = new Map([["cfg-1", { id: "cfg-1", threshold: 1, security_mode: "standard" }]]);
    const approvals = new Map([
      [UUID, [{ id: "app-1", group_id: UUID, guardian_email_hash: "h1", masked_email: null, relayer_request_id: "req-1", status: "email_sent", last_error: null }]],
    ]);
    const chainRequests = new Map([
      [UUID, [{ id: "cr-1", group_id: UUID, chain_id: 84532, status: "pending" }]],
    ]);
    const submissions = new Map([
      ["app-1:cr-1", { id: "app-1:cr-1", approval_id: "app-1", chain_request_id: "cr-1", chain_id: 84532, relayer_request_id: "req-1", status: "request_sent", email_auth_msg_json: null, proof_hash: null, tx_hash: null, last_error: null }],
    ]);

    const app = createApp({
      store: makeFakeStore({ groups, configs, approvals, chainRequests, submissions }),
      relayerConfig: baseConfig,
    });

    const res = await request(app)
      .post("/poll-group-status")
      .send({ groupId: UUID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.changed).toBe(true);
  });
});
