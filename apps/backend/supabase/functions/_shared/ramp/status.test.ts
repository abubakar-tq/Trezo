import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapTransakStatus } from "./status.ts";

// Run: deno test apps/backend/supabase/functions/_shared/ramp/status.test.ts

Deno.test("created statuses", () => {
  assertEquals(mapTransakStatus("ORDER_CREATED"), "created");
  assertEquals(mapTransakStatus("AWAITING_PAYMENT_FROM_USER"), "created");
});

Deno.test("payment_pending statuses", () => {
  assertEquals(mapTransakStatus("PAYMENT_DONE_MARKED_BY_USER"), "payment_pending");
  assertEquals(mapTransakStatus("ORDER_PAYMENT_VERIFYING"), "payment_pending");
});

Deno.test("processing statuses", () => {
  assertEquals(mapTransakStatus("ORDER_PROCESSING"), "processing");
  assertEquals(mapTransakStatus("PROCESSING"), "processing");
  assertEquals(mapTransakStatus("PENDING_DELIVERY_FROM_TRANSAK"), "processing");
  assertEquals(mapTransakStatus("CRYPTO_LIQUIDITY_PROVIDER_PENDING"), "processing");
});

Deno.test("completed statuses (the ones that trigger fulfillment)", () => {
  assertEquals(mapTransakStatus("ORDER_COMPLETED"), "completed");
  assertEquals(mapTransakStatus("COMPLETED"), "completed");
});

Deno.test("failed statuses", () => {
  assertEquals(mapTransakStatus("ORDER_FAILED"), "failed");
  assertEquals(mapTransakStatus("ORDER_CANCELLED"), "failed");
  assertEquals(mapTransakStatus("CANCELLED"), "failed");
  assertEquals(mapTransakStatus("FAILED"), "failed");
  assertEquals(mapTransakStatus("REFUND_REQUEST_INITIATED"), "failed");
});

Deno.test("refunded / expired statuses", () => {
  assertEquals(mapTransakStatus("ORDER_REFUNDED"), "refunded");
  assertEquals(mapTransakStatus("REFUNDED"), "refunded");
  assertEquals(mapTransakStatus("ORDER_EXPIRED"), "expired");
  assertEquals(mapTransakStatus("EXPIRED"), "expired");
});

Deno.test("unknown status defaults to processing (never completed)", () => {
  assertEquals(mapTransakStatus("SOME_NEW_EVENT"), "processing");
  assertEquals(mapTransakStatus(""), "processing");
});
