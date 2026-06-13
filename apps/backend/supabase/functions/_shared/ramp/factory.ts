import { IRampProvider } from "./types.ts";
import { TransakProvider } from "./providers/TransakProvider.ts";
import { MockProvider } from "./providers/MockProvider.ts";

export function getRampProvider(overrideType?: string): IRampProvider {
  const providerType = overrideType || Deno.env.get("RAMP_PROVIDER") || "mock";
  
  if (providerType === "transak") {
    return new TransakProvider();
  }
  
  return new MockProvider();
}
