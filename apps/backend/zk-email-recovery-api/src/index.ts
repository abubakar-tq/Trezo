import "dotenv/config";
import express from "express";
import cors from "cors";
import { RecoveryStore } from "./recovery-store.js";
import { createRecoveryRouter } from "./recovery-router.js";
import type { ZkEmailRelayerConfig } from "./zk-email-relayer-client.js";

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
    acceptanceTemplateIdx: Number(process.env.ZK_EMAIL_ACCEPTANCE_TEMPLATE_IDX ?? "0"),
    recoveryTemplateIdx: Number(process.env.ZK_EMAIL_RECOVERY_TEMPLATE_IDX ?? "1"),
    proofMode: process.env.ZK_EMAIL_PROOF_MODE === "reusable" ? "reusable" : "per_chain_hosted",
  };

  const store = new RecoveryStore({
    url: supabaseUrl,
    serviceRoleKey: supabaseServiceKey,
  });

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "0.1.0",
      relayer: relayerConfig.baseUrl,
      proofMode: relayerConfig.proofMode,
    });
  });

  app.use("/", createRecoveryRouter(store, relayerConfig));

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
