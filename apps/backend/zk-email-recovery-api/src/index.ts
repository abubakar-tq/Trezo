import "dotenv/config";
import { RecoveryStore } from "./recovery-store.js";
import type { ZkEmailRelayerConfig } from "./zk-email-relayer-client.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const relayerUrl = requireEnv("ZK_EMAIL_RELAYER_URL");

  const relayerConfig: ZkEmailRelayerConfig = {
    baseUrl: relayerUrl,
    apiKey: process.env.ZK_EMAIL_RELAYER_API_KEY || undefined,
    // Both templates resolve to idx=0 on the canonical EmailRecoveryCommandHandler;
    // the handler reverts with InvalidTemplateIndex for any other value.
    acceptanceTemplateIdx: Number(process.env.ZK_EMAIL_ACCEPTANCE_TEMPLATE_IDX ?? "0"),
    recoveryTemplateIdx: Number(process.env.ZK_EMAIL_RECOVERY_TEMPLATE_IDX ?? "0"),
    proofMode: process.env.ZK_EMAIL_PROOF_MODE === "reusable" ? "reusable" : "per_chain_hosted",
  };

  const store = new RecoveryStore({
    url: supabaseUrl,
    serviceRoleKey: supabaseServiceKey,
  });

  const app = createApp({ store, relayerConfig });

  app.listen(PORT, () => {
    console.log(`ZK Email Recovery API listening on port ${PORT}`);
    console.log(`Relayer: ${relayerConfig.baseUrl}`);
    console.log(`Proof mode: ${relayerConfig.proofMode}`);
  });
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
