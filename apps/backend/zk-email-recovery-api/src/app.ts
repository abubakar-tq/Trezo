import express, { type Express } from "express";
import cors from "cors";
import type { RecoveryStore } from "./recovery-store.js";
import { createRecoveryRouter } from "./recovery-router.js";
import type { ZkEmailRelayerConfig } from "./zk-email-relayer-client.js";

export type CreateAppDeps = {
  store: RecoveryStore;
  relayerConfig: ZkEmailRelayerConfig;
  version?: string;
};

export function createApp({ store, relayerConfig, version = "0.1.0" }: CreateAppDeps): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version,
      relayer: relayerConfig.baseUrl,
      proofMode: relayerConfig.proofMode,
    });
  });

  app.use("/", createRecoveryRouter(store, relayerConfig));

  return app;
}
