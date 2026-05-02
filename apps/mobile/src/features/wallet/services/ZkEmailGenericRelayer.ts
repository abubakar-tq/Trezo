import type { Hex } from "viem";
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

type RelayerAcceptanceRequestBody = {
  controller_eth_addr: string;
  guardian_email_addr: string;
  account_code?: string;
  template_idx: number;
  command: string;
};

type RelayerRecoveryRequestBody = {
  controller_eth_addr: string;
  guardian_email_addr: string;
  template_idx: number;
  command: string;
};

type RelayerStatusRequestBody = {
  request_id: string | number;
};

type RelayerCompleteRequestBody = {
  account_eth_addr: string;
  controller_eth_addr: string;
  complete_calldata: string;
};

type RelayerAccountSaltRequestBody = {
  account_code: string;
  email_addr: string;
};

type RelayerGenericResponse = {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
};

type RelayerRequestResponse = RelayerGenericResponse & {
  request_id?: string | number;
  requestId?: string;
  id?: string;
};

type RelayerStatusResponse = RelayerGenericResponse & {
  status?: string;
  is_success?: boolean;
  email_nullifier?: string;
  account_salt?: string;
  email_auth_msg?: unknown;
  emailAuthMsg?: unknown;
};

type RelayerSaltResponse = RelayerGenericResponse & {
  account_salt?: string;
};

const RELAYER_TIMEOUT_MS = 30_000;

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

export class ZkEmailGenericRelayer implements ZkEmailRelayerAdapter {
  private config: ZkEmailRelayerConfig;

  constructor(config: ZkEmailRelayerConfig) {
    this.config = config;
  }

  async sendAcceptanceRequest(params: AcceptanceRequestParams): Promise<RelayerRequestRef> {
    const body: RelayerAcceptanceRequestBody = {
      controller_eth_addr: params.controllerEthAddr,
      guardian_email_addr: params.guardianEmailAddr,
      template_idx: Number(params.templateIdx),
      command: params.command,
    };

    const resp = await this.post<RelayerRequestResponse>("acceptanceRequest", body);

    const requestId = resp.request_id ?? resp.requestId ?? resp.id;
    if (!requestId) {
      throw new Error(
        `Relayer did not return request_id for acceptance: ${resp.error ?? "unknown error"}`,
      );
    }

    return {
      requestId: String(requestId),
      guardianEmail: params.guardianEmailAddr,
    };
  }

  async sendRecoveryRequest(params: RecoveryEmailRequestParams): Promise<RelayerRequestRef> {
    const body: RelayerRecoveryRequestBody = {
      controller_eth_addr: params.controllerEthAddr,
      guardian_email_addr: params.guardianEmailAddr,
      template_idx: Number(params.templateIdx),
      command: params.command,
    };

    const resp = await this.post<RelayerRequestResponse>("recoveryRequest", body);

    const requestId = resp.request_id ?? resp.requestId ?? resp.id;
    if (!requestId) {
      throw new Error(
        `Relayer did not return request_id for recovery: ${resp.error ?? "unknown error"}`,
      );
    }

    return {
      requestId: String(requestId),
      guardianEmail: params.guardianEmailAddr,
    };
  }

  async getRequestStatus(requestId: string): Promise<RelayerRequestStatus> {
    const body: RelayerStatusRequestBody = { request_id: requestId };
    const resp = await this.post<RelayerStatusResponse>("requestStatus", body);

    const status = this.mapRelayerStatus(resp.status, resp.is_success);

    let emailAuthMsg: EmailAuthMsgData | null = null;
    const rawEmailAuthMsg = resp.email_auth_msg ?? resp.emailAuthMsg;
    if (rawEmailAuthMsg) {
      emailAuthMsg = this.parseEmailAuthMsg(rawEmailAuthMsg);
    }

    return {
      requestId,
      status,
      emailAuthMsg,
      error: resp.error ?? null,
    };
  }

  async submitProofToChain(params: SubmitProofToChainParams): Promise<ChainSubmissionResult> {
    try {
      const result = await this.completeRecovery({
        chainId: params.chainId,
        smartAccountAddress: params.smartAccountAddress,
        recoveryData: params.recoveryData,
        emailRecoveryModuleAddress: params.emailRecoveryModuleAddress,
      });

      return {
        txHash: result.txHash,
        success: result.success,
        error: result.error,
      };
    } catch (err) {
      return {
        txHash: null,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error submitting proof to chain",
      };
    }
  }

  async completeRecovery(params: CompleteRecoveryRequestParams): Promise<CompleteRecoveryResult> {
    const body: RelayerCompleteRequestBody = {
      account_eth_addr: params.smartAccountAddress,
      controller_eth_addr: params.emailRecoveryModuleAddress,
      complete_calldata: params.recoveryData,
    };

    try {
      const resp = await this.post<RelayerGenericResponse>("completeRequest", body);

      return {
        txHash: (resp.tx_hash as Hex | undefined) ?? null,
        success: resp.success !== false,
        error: resp.error ?? null,
      };
    } catch (err) {
      return {
        txHash: null,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error completing recovery",
      };
    }
  }

  async getAccountSalt(
    accountCode: string,
    guardianEmailAddr: string,
  ): Promise<string | null> {
    const body: RelayerAccountSaltRequestBody = {
      account_code: accountCode,
      email_addr: guardianEmailAddr,
    };

    const resp = await this.post<RelayerSaltResponse>("getAccountSalt", body);
    return resp.account_salt ?? null;
  }

  async echo(): Promise<boolean> {
    try {
      const resp = await fetch(`${normalizeBaseUrl(this.config.baseUrl)}/echo`, {
        method: "GET",
        signal: AbortSignal.timeout(RELAYER_TIMEOUT_MS),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${normalizeBaseUrl(this.config.baseUrl)}/${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RELAYER_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(
        `Relayer ${endpoint} returned ${resp.status}: ${text || resp.statusText}`,
      );
    }

    return (await resp.json()) as T;
  }

  private mapRelayerStatus(
    raw: string | undefined,
    isSuccess?: boolean,
  ): "pending" | "email_sent" | "email_received" | "proof_generated" | "failed" {
    if (isSuccess === true) return "proof_generated";

    switch (raw) {
      case "EmailSent":
      case "email_sent":
      case "sent":
        return "email_sent";
      case "EmailReceived":
      case "email_received":
      case "received":
        return "email_received";
      case "ProofGenerated":
      case "proof_generated":
      case "proof_ready":
      case "success":
      case "Success":
        return "proof_generated";
      case "Failed":
      case "failed":
      case "error":
      case "Error":
        return "failed";
      case "Pending":
      case "pending":
        return "pending";
      default:
        return "pending";
    }
  }

  private parseEmailAuthMsg(raw: unknown): EmailAuthMsgData {
    const msg = raw as Record<string, unknown>;
    const proof = msg.proof as Record<string, unknown> | undefined;

    return {
      templateId: BigInt(
        (msg.templateId as number | string) ?? (msg.template_id as number | string) ?? 0,
      ),
      commandParams: (msg.commandParams as Hex[]) ?? (msg.command_params as Hex[]) ?? [],
      skippedCommandPrefix: BigInt(
        (msg.skippedCommandPrefix as number | string)
          ?? (msg.skipped_command_prefix as number | string)
          ?? 0,
      ),
      proof: {
        domainName: (proof?.domainName as string) ?? (proof?.domain_name as string) ?? "",
        publicKeyHash: (proof?.publicKeyHash as Hex) ?? (proof?.public_key_hash as Hex) ?? "0x",
        timestamp: BigInt((proof?.timestamp as number | string) ?? 0),
        maskedCommand: (proof?.maskedCommand as string) ?? (proof?.masked_command as string) ?? "",
        emailNullifier: (proof?.emailNullifier as Hex) ?? (proof?.email_nullifier as Hex) ?? "0x",
        accountSalt: (proof?.accountSalt as Hex) ?? (proof?.account_salt as Hex) ?? "0x",
        isCodeExist: (proof?.isCodeExist as boolean) ?? (proof?.is_code_exist as boolean) ?? false,
        proof: (proof?.proof as Hex) ?? "0x",
      },
    };
  }
}
