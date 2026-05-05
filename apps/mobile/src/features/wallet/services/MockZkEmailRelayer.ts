import { keccak256, stringToHex } from "viem";
import type {
  AcceptanceRequestParams,
  ChainSubmissionResult,
  CompleteRecoveryRequestParams,
  CompleteRecoveryResult,
  EmailAuthMsgData,
  RecoveryEmailRequestParams,
  RelayerRequestRef,
  RelayerRequestStatus,
  SubmitProofToChainParams,
  ZkEmailRelayerAdapter,
  ZkEmailRelayerConfig,
} from "./ZkEmailRelayerAdapter";

type PendingMockRequest = {
  requestId: string;
  guardianEmail: string;
  command: string;
  controllerEthAddr: string;
  createdAt: number;
  status:
    | "pending"
    | "email_sent"
    | "email_received"
    | "proof_generated"
    | "failed";
  emailAuthMsg: EmailAuthMsgData | null;
  error: string | null;
};

const MOCK_EMAIL_DELAY_MS = 3000;
const MOCK_PROOF_DELAY_MS = 8000;

export class MockZkEmailRelayer implements ZkEmailRelayerAdapter {
  private static pendingRequests: Map<string, PendingMockRequest> = new Map();
  private static requestCounter = 0;

  private config: ZkEmailRelayerConfig;

  constructor(config?: Partial<ZkEmailRelayerConfig>) {
    this.config = {
      baseUrl: "mock://local",
      proofMode: config?.proofMode ?? "per_chain",
      acceptanceTemplateIdx: config?.acceptanceTemplateIdx ?? 0,
      recoveryTemplateIdx: config?.recoveryTemplateIdx ?? 1,
    };
  }

  static reset(): void {
    MockZkEmailRelayer.pendingRequests.clear();
    MockZkEmailRelayer.requestCounter = 0;
  }

  async sendAcceptanceRequest(params: AcceptanceRequestParams): Promise<RelayerRequestRef> {
    const requestId = this.generateRequestId("accept", params.controllerEthAddr);
    MockZkEmailRelayer.pendingRequests.set(requestId, {
      requestId,
      guardianEmail: params.guardianEmailAddr,
      command: params.command,
      controllerEthAddr: params.controllerEthAddr,
      createdAt: Date.now(),
      status: "email_sent",
      emailAuthMsg: null,
      error: null,
    });
    return { requestId, guardianEmail: params.guardianEmailAddr };
  }

  async sendRecoveryRequest(params: RecoveryEmailRequestParams): Promise<RelayerRequestRef> {
    const requestId = this.generateRequestId("recover", params.controllerEthAddr);
    MockZkEmailRelayer.pendingRequests.set(requestId, {
      requestId,
      guardianEmail: params.guardianEmailAddr,
      command: params.command,
      controllerEthAddr: params.controllerEthAddr,
      createdAt: Date.now(),
      status: "email_sent",
      emailAuthMsg: null,
      error: null,
    });
    return { requestId, guardianEmail: params.guardianEmailAddr };
  }

  async getRequestStatus(requestId: string): Promise<RelayerRequestStatus> {
    const req = MockZkEmailRelayer.pendingRequests.get(requestId);
    if (!req) {
      return {
        requestId,
        status: "failed",
        emailAuthMsg: null,
        error: "Request not found",
      };
    }

    const elapsed = Date.now() - req.createdAt;
    let status = req.status;

    if (req.status === "email_sent" && elapsed >= MOCK_EMAIL_DELAY_MS) {
      status = "email_received";
      req.status = status;
    }

    if (req.status === "email_received" && elapsed >= MOCK_PROOF_DELAY_MS) {
      if (!req.emailAuthMsg) {
        req.emailAuthMsg = this.buildMockProof(
          req.controllerEthAddr,
          req.guardianEmail,
          req.command,
        );
      }
      status = "proof_generated";
      req.status = status;
    }

    return {
      requestId,
      status,
      emailAuthMsg: status === "proof_generated" ? req.emailAuthMsg : null,
      error: req.error,
    };
  }

  async submitProofToChain(_params: SubmitProofToChainParams): Promise<ChainSubmissionResult> {
    return {
      txHash: null,
      success: false,
      error:
        "V1: Mock relayer does not submit proofs on-chain directly. On Anvil, run `make mock-vote-recovery-local` then `make mock-complete-email-recovery-local`. On testnet, the ZK Email hosted relayer handles this.",
    };
  }

  async completeRecovery(_params: CompleteRecoveryRequestParams): Promise<CompleteRecoveryResult> {
    return {
      txHash: null,
      success: false,
      error:
        "V1: Mock relayer does not execute recovery on-chain. On Anvil, run `make mock-complete-email-recovery-local` with ACCOUNT, RECOVERY_HARNESS, and RECOVERY_DATA env vars. On testnet, the ZK Email hosted relayer handles execution.",
    };
  }

  private generateRequestId(prefix: string, addr: string): string {
    MockZkEmailRelayer.requestCounter += 1;
    const hash = keccak256(
      stringToHex(`${prefix}-${addr}-${MockZkEmailRelayer.requestCounter}-${Date.now()}`),
    );
    return `mock-${prefix}-${hash.slice(2, 10)}`;
  }

  private buildMockProof(
    controllerAddr: string,
    guardianEmail: string,
    command: string,
  ): EmailAuthMsgData {
    const emailNullifier = keccak256(stringToHex(`nullifier-${guardianEmail}-${Date.now()}`));
    const accountSalt = keccak256(stringToHex(guardianEmail));
    const publicKeyHash = keccak256(stringToHex(`dkim-${guardianEmail}`));
    const mockProofBytes = keccak256(stringToHex(`zk-proof-${guardianEmail}-${Date.now()}`));

    return {
      templateId: 1n,
      commandParams: [stringToHex(command)],
      skippedCommandPrefix: 0n,
      proof: {
        domainName: "gmail.com",
        publicKeyHash,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        maskedCommand: command,
        emailNullifier,
        accountSalt,
        isCodeExist: true,
        proof: mockProofBytes,
      },
    };
  }
}
