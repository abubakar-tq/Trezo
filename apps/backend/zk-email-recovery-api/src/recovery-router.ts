import { Router, type Request, type Response } from "express";
import { RecoveryStore } from "./recovery-store.js";
import { ZkEmailRelayerClient, type ZkEmailRelayerConfig } from "./zk-email-relayer-client.js";
import {
  AcceptanceRequestSchema,
  RecoveryRequestSchema,
  RequestStatusSchema,
  CompleteRequestSchema,
  AccountSaltSchema,
  SendGroupRecoveryRequestsSchema,
  PollGroupStatusSchema,
} from "./schemas.js";

const RECOVERY_COMMAND_TEMPLATE = "Recover account {ethAddr} using recovery hash {recoveryHash}";

export function createRecoveryRouter(store: RecoveryStore, relayerConfig: ZkEmailRelayerConfig): Router {
  const router = Router();
  const relayer = new ZkEmailRelayerClient(relayerConfig);

  router.post("/zk-email/acceptance-request", async (req: Request, res: Response) => {
    const parsed = AcceptanceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    try {
      const result = await relayer.sendAcceptanceRequest(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Relayer error" });
    }
  });

  router.post("/zk-email/recovery-request", async (req: Request, res: Response) => {
    const parsed = RecoveryRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    try {
      const result = await relayer.sendRecoveryRequest(parsed.data);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Relayer error" });
    }
  });

  router.post("/zk-email/request-status", async (req: Request, res: Response) => {
    const parsed = RequestStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    try {
      const result = await relayer.getRequestStatus(parsed.data.requestId);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Relayer error" });
    }
  });

  router.post("/zk-email/complete-request", async (req: Request, res: Response) => {
    const parsed = CompleteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    try {
      const result = await relayer.completeRequest(parsed.data);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Relayer error" });
    }
  });

  router.post("/zk-email/account-salt", async (req: Request, res: Response) => {
    const parsed = AccountSaltSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    try {
      const accountSalt = await relayer.getAccountSalt(parsed.data);
      res.json({ success: true, accountSalt });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Relayer error" });
    }
  });

  router.post("/send-group-recovery-requests", async (req: Request, res: Response) => {
    const parsed = SendGroupRecoveryRequestsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { groupId } = parsed.data;

    try {
      const group = await store.getGroup(groupId);
      if (!group) {
        res.status(404).json({ error: "Recovery group not found" });
        return;
      }

      if (!["collecting_approvals", "draft", "sending_approvals"].includes(group.status)) {
        res.status(409).json({ error: `Group is in status '${group.status}', cannot send requests` });
        return;
      }

      await store.updateGroupStatus(groupId, "sending_approvals");

      const config = await store.getConfig(group.config_id);
      if (!config) {
        res.status(404).json({ error: "Recovery config not found" });
        return;
      }

      const guardians = await store.getGuardians(group.config_id);
      const approvals = await store.getApprovals(groupId);
      const chainRequests = await store.getChainRequests(groupId);

      const command = RECOVERY_COMMAND_TEMPLATE
        .replace("{ethAddr}", group.smart_account_address)
        .replace("{recoveryHash}", group.multichain_recovery_data_hash);

      const results: Array<{
        approvalId: string;
        guardianEmailHash: string;
        sent: boolean;
        relayerRequestIds: string[];
        error: string | null;
      }> = [];

      for (const approval of approvals) {
        if (approval.status !== "pending" && approval.status !== "failed") continue;

        const guardian = guardians.find((g) => g.email_hash === approval.guardian_email_hash);
        if (!guardian) {
          await store.updateApprovalStatus(approval.id, "failed", {
            last_error: "Guardian not found in config",
          });
          results.push({
            approvalId: approval.id,
            guardianEmailHash: approval.guardian_email_hash,
            sent: false,
            relayerRequestIds: [],
            error: "Guardian not found",
          });
          continue;
        }

        const guardianEmail = store.resolveGuardianEmail(guardian);
        if (!guardianEmail) {
          await store.updateApprovalStatus(approval.id, "failed", {
            last_error: "Guardian email is encrypted (security_mode=extra). Cannot send via hosted relayer server-side.",
          });
          results.push({
            approvalId: approval.id,
            guardianEmailHash: approval.guardian_email_hash,
            sent: false,
            relayerRequestIds: [],
            error: "Email locked by vault key",
          });
          continue;
        }

        const relayerRequestIds: string[] = [];

        try {
          if (relayerConfig.proofMode === "reusable") {
            const ref = await relayer.sendRecoveryRequest({
              controllerEthAddr: group.smart_account_address,
              guardianEmailAddr: guardianEmail,
              command,
            });
            relayerRequestIds.push(ref.requestId);

            for (const chainReq of chainRequests) {
              await store.upsertSubmission({
                approvalId: approval.id,
                chainRequestId: chainReq.id,
                chainId: chainReq.chain_id,
                relayerRequestId: ref.requestId,
              });
            }
          } else {
            for (const chainReq of chainRequests) {
              const ref = await relayer.sendRecoveryRequest({
                controllerEthAddr: group.smart_account_address,
                guardianEmailAddr: guardianEmail,
                command,
              });
              relayerRequestIds.push(ref.requestId);

              await store.upsertSubmission({
                approvalId: approval.id,
                chainRequestId: chainReq.id,
                chainId: chainReq.chain_id,
                relayerRequestId: ref.requestId,
              });
            }
          }

          await store.updateApprovalStatus(approval.id, "email_sent", {
            relayer_request_id: relayerRequestIds[0] ?? null,
            last_error: null,
          });

          results.push({
            approvalId: approval.id,
            guardianEmailHash: approval.guardian_email_hash,
            sent: true,
            relayerRequestIds,
            error: null,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Unknown relayer error";
          await store.updateApprovalStatus(approval.id, "failed", {
            last_error: errMsg,
          });

          results.push({
            approvalId: approval.id,
            guardianEmailHash: approval.guardian_email_hash,
            sent: false,
            relayerRequestIds,
            error: errMsg,
          });
        }
      }

      await store.updateGroupStatus(groupId, "collecting_approvals");

      res.json({ success: true, groupId, results });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  router.post("/poll-group-status", async (req: Request, res: Response) => {
    const parsed = PollGroupStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { groupId } = parsed.data;

    try {
      const approvals = await store.getApprovals(groupId);
      const approvalIds = approvals.map((a) => a.id);
      const submissions = await store.getSubmissionsByApprovalIds(approvalIds);

      const activeSubmissions = submissions.filter(
        (s) => s.relayer_request_id && !isTerminalSubmissionStatus(s.status),
      );

      let changed = false;

      for (const submission of activeSubmissions) {
        try {
          const status = await relayer.getRequestStatus(submission.relayer_request_id!);

          const nextStatus = submissionStatusFromRelayer(status.status);
          if (nextStatus && submission.status !== nextStatus) {
            const proofHash = status.emailAuthMsg
              ? `0x${JSON.stringify(status.emailAuthMsg).split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0).toString(16).padStart(64, "0")}`
              : null;

            await store.updateSubmissionStatus(submission.id, nextStatus, {
              email_auth_msg_json: status.emailAuthMsg ?? null,
              proof_hash: proofHash,
              last_error: status.error,
            });

            changed = true;
          }

          const approval = approvals.find((a) => a.id === submission.approval_id);
          if (approval) {
            const nextApprovalStatus = approvalStatusFromRelayer(status.status);
            if (nextApprovalStatus && approval.status !== nextApprovalStatus) {
              await store.updateApprovalStatus(approval.id, nextApprovalStatus, {
                last_error: status.error,
              });
              changed = true;
            }
          }
        } catch (err) {
          await store.updateSubmissionStatus(submission.id, submission.status, {
            last_error: err instanceof Error ? err.message : "Poll failed",
          });
        }
      }

      const config = approvals.length > 0 ? await store.getConfig(
        (await store.getGroup(groupId))?.config_id ?? "",
      ) : null;
      const threshold = config?.threshold ?? approvals.length;

      const chainRequests = await store.getChainRequests(groupId);
      for (const chainReq of chainRequests) {
        if (!["pending", "proofs_pending", "proofs_submitted", "threshold_reached"].includes(chainReq.status)) {
          continue;
        }

        const chainSubs = submissions.filter((s) => s.chain_request_id === chainReq.id);
        const readyCount = chainSubs.filter((s) => isProofReadySubmissionStatus(s.status)).length;

        if (readyCount >= threshold) {
          await store.updateChainRequestStatus(chainReq.id, "ready_to_execute");
          changed = true;
        }
      }

      res.json({ success: true, groupId, changed });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  return router;
}

function isTerminalSubmissionStatus(status: string): boolean {
  return ["proof_ready", "submitted", "confirmed", "failed"].includes(status);
}

function isProofReadySubmissionStatus(status: string): boolean {
  return ["proof_ready", "submitted", "confirmed"].includes(status);
}

function submissionStatusFromRelayer(
  status: string,
): string | null {
  switch (status) {
    case "proof_generated":
      return "proof_ready";
    case "failed":
      return "failed";
    case "email_sent":
    case "email_received":
    case "pending":
      return "request_sent";
    default:
      return null;
  }
}

function approvalStatusFromRelayer(
  status: string,
): string | null {
  switch (status) {
    case "proof_generated":
      return "proof_generated";
    case "email_received":
      return "guardian_replied";
    case "email_sent":
      return "email_sent";
    case "failed":
      return "failed";
    default:
      return null;
  }
}
