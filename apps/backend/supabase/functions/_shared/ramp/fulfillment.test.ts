import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TestnetFulfillmentService } from "./TestnetFulfillmentService.ts";

// Run: deno test --allow-net --allow-env \
//   apps/backend/supabase/functions/_shared/ramp/fulfillment.test.ts
//
// These exercise the GUARD MATRIX only. Each case short-circuits to null BEFORE
// any wallet client is built, so no real transaction is ever sent.

const params = {
  walletAddress: "0x000000000000000000000000000000000000dEaD",
  fiatAmount: 50,
  cryptoCurrency: "ETH",
  chainId: 84532,
};

function clearEnv() {
  Deno.env.delete("TESTNET_DEMO_FULFILLMENT");
  Deno.env.delete("TRANSAK_ENV");
  Deno.env.delete("TREASURY_PRIVATE_KEY");
}

Deno.test("isTestnetChain recognises supported testnets only", () => {
  assertEquals(TestnetFulfillmentService.isTestnetChain(84532), true); // Base Sepolia
  assertEquals(TestnetFulfillmentService.isTestnetChain(11155111), true); // Sepolia
  assertEquals(TestnetFulfillmentService.isTestnetChain(421614), true); // Arb Sepolia
  assertEquals(TestnetFulfillmentService.isTestnetChain(1), false); // mainnet
  assertEquals(TestnetFulfillmentService.isTestnetChain(8453), false); // Base mainnet
  assertEquals(TestnetFulfillmentService.isTestnetChain(31337), false); // Anvil (Local handles it)
});

Deno.test("guard: disabled when TESTNET_DEMO_FULFILLMENT != true", async () => {
  clearEnv();
  const svc = new TestnetFulfillmentService();
  assertEquals(await svc.fulfill(params), null);
});

Deno.test("guard: never runs in production", async () => {
  clearEnv();
  Deno.env.set("TESTNET_DEMO_FULFILLMENT", "true");
  Deno.env.set("TRANSAK_ENV", "PRODUCTION");
  const svc = new TestnetFulfillmentService();
  assertEquals(await svc.fulfill(params), null);
});

Deno.test("guard: skips unknown / mainnet chains even when enabled", async () => {
  clearEnv();
  Deno.env.set("TESTNET_DEMO_FULFILLMENT", "true");
  Deno.env.set("TRANSAK_ENV", "STAGING");
  const svc = new TestnetFulfillmentService();
  assertEquals(await svc.fulfill({ ...params, chainId: 1 }), null);
  clearEnv();
});
