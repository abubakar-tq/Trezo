import { IRampProvider } from "./types.ts";
import { TransakProvider } from "./providers/TransakProvider.ts";
import { MockProvider } from "./providers/MockProvider.ts";

export function getRampProvider(): IRampProvider {
  const providerType = Deno.env.get("RAMP_PROVIDER") || "mock";
  
  if (providerType === "transak") {
    return new TransakProvider();
  }
  
  return new MockProvider();
}
