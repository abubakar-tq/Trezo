import { describe, it, expect } from "vitest";
import {
  AcceptanceRequestSchema,
  RecoveryRequestSchema,
  RequestStatusSchema,
  CompleteRequestSchema,
  AccountSaltSchema,
  SendGroupRecoveryRequestsSchema,
  PollGroupStatusSchema,
} from "./schemas.js";

const ADDR = "0x" + "a".repeat(40);
const ACCOUNT_CODE = "0x" + "b".repeat(64);
const EMAIL = "guardian@example.com";
const UUID = "11111111-1111-1111-1111-111111111111";

describe("AcceptanceRequestSchema", () => {
  it("accepts a canonical payload", () => {
    const r = AcceptanceRequestSchema.safeParse({
      controllerEthAddr: ADDR,
      guardianEmailAddr: EMAIL,
      accountCode: ACCOUNT_CODE,
      command: "Accept guardian request for 0x...",
    });
    expect(r.success).toBe(true);
  });

  it("rejects mixed-case eth addresses", () => {
    const r = AcceptanceRequestSchema.safeParse({
      controllerEthAddr: "0x" + "A".repeat(40),
      guardianEmailAddr: EMAIL,
      accountCode: ACCOUNT_CODE,
      command: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejects accountCode that isn't 32 bytes of lowercase hex", () => {
    const r = AcceptanceRequestSchema.safeParse({
      controllerEthAddr: ADDR,
      guardianEmailAddr: EMAIL,
      accountCode: "0x" + "b".repeat(63),
      command: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty command", () => {
    const r = AcceptanceRequestSchema.safeParse({
      controllerEthAddr: ADDR,
      guardianEmailAddr: EMAIL,
      accountCode: ACCOUNT_CODE,
      command: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("RecoveryRequestSchema", () => {
  it("accepts payload without optional chainId", () => {
    const r = RecoveryRequestSchema.safeParse({
      controllerEthAddr: ADDR,
      guardianEmailAddr: EMAIL,
      command: "Recover account ... using recovery hash 0x...",
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative chainId", () => {
    const r = RecoveryRequestSchema.safeParse({
      controllerEthAddr: ADDR,
      guardianEmailAddr: EMAIL,
      command: "x",
      chainId: -1,
    });
    expect(r.success).toBe(false);
  });
});

describe("RequestStatusSchema / CompleteRequestSchema / AccountSaltSchema", () => {
  it("RequestStatus requires non-empty requestId", () => {
    expect(RequestStatusSchema.safeParse({ requestId: "" }).success).toBe(false);
    expect(RequestStatusSchema.safeParse({ requestId: "abc" }).success).toBe(true);
  });

  it("CompleteRequest requires both controller and account addrs", () => {
    expect(
      CompleteRequestSchema.safeParse({
        controllerEthAddr: ADDR,
        accountEthAddr: ADDR,
        completeCalldata: "0xdead",
      }).success,
    ).toBe(true);
    expect(
      CompleteRequestSchema.safeParse({
        controllerEthAddr: ADDR,
        completeCalldata: "0xdead",
      }).success,
    ).toBe(false);
  });

  it("AccountSalt requires account code + email", () => {
    expect(
      AccountSaltSchema.safeParse({
        accountCode: ACCOUNT_CODE,
        guardianEmailAddr: EMAIL,
      }).success,
    ).toBe(true);
  });
});

describe("Group schemas", () => {
  it("SendGroupRecoveryRequests requires a UUID", () => {
    expect(SendGroupRecoveryRequestsSchema.safeParse({ groupId: UUID }).success).toBe(true);
    expect(SendGroupRecoveryRequestsSchema.safeParse({ groupId: "not-a-uuid" }).success).toBe(false);
  });
  it("PollGroupStatus requires a UUID", () => {
    expect(PollGroupStatusSchema.safeParse({ groupId: UUID }).success).toBe(true);
    expect(PollGroupStatusSchema.safeParse({ groupId: "not-a-uuid" }).success).toBe(false);
  });
});
