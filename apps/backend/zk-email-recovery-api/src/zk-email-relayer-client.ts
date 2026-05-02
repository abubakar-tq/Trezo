export type ZkEmailRelayerConfig = {
  baseUrl: string;
  apiKey?: string;
  acceptanceTemplateIdx: number;
  recoveryTemplateIdx: number;
  proofMode: "per_chain_hosted" | "reusable";
};

export type RelayerRequestRef = {
  requestId: string;
  guardianEmail: string;
};

export type RelayerRequestStatus = {
  requestId: string;
  status: "pending" | "email_sent" | "email_received" | "proof_generated" | "failed";
  emailAuthMsg: unknown | null;
  error: string | null;
};

const RELAYER_TIMEOUT_MS = 30_000;
const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

export class ZkEmailRelayerClient {
  private config: ZkEmailRelayerConfig;

  constructor(config: ZkEmailRelayerConfig) {
    this.config = config;
  }

  async sendAcceptanceRequest(params: {
    controllerEthAddr: string;
    guardianEmailAddr: string;
    templateIdx?: number;
    command: string;
  }): Promise<RelayerRequestRef> {
    const body = {
      controller_eth_addr: params.controllerEthAddr,
      guardian_email_addr: params.guardianEmailAddr,
      template_idx: params.templateIdx ?? this.config.acceptanceTemplateIdx,
      command: params.command,
    };

    const resp = await this.post<RelayerRequestResponse>("acceptanceRequest", body);

    const requestId = resp.request_id ?? resp.requestId ?? resp.id;
    if (!requestId) {
      throw new Error(`Relayer did not return request_id for acceptance: ${resp.error ?? "unknown"}`);
    }

    return { requestId: String(requestId), guardianEmail: params.guardianEmailAddr };
  }

  async sendRecoveryRequest(params: {
    controllerEthAddr: string;
    guardianEmailAddr: string;
    templateIdx?: number;
    command: string;
  }): Promise<RelayerRequestRef> {
    const body = {
      controller_eth_addr: params.controllerEthAddr,
      guardian_email_addr: params.guardianEmailAddr,
      template_idx: params.templateIdx ?? this.config.recoveryTemplateIdx,
      command: params.command,
    };

    const resp = await this.post<RelayerRequestResponse>("recoveryRequest", body);

    const requestId = resp.request_id ?? resp.requestId ?? resp.id;
    if (!requestId) {
      throw new Error(`Relayer did not return request_id for recovery: ${resp.error ?? "unknown"}`);
    }

    return { requestId: String(requestId), guardianEmail: params.guardianEmailAddr };
  }

  async getRequestStatus(requestId: string): Promise<RelayerRequestStatus> {
    const body = { request_id: requestId };
    const resp = await this.post<RelayerStatusResponse>("requestStatus", body);

    return {
      requestId,
      status: this.mapStatus(resp.status),
      emailAuthMsg: resp.email_auth_msg ?? resp.emailAuthMsg ?? null,
      error: resp.error ?? null,
    };
  }

  async completeRequest(params: {
    controllerEthAddr: string;
    recoveryData: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const body = {
      controller_eth_addr: params.controllerEthAddr,
      recovery_data: params.recoveryData,
    };

    try {
      const resp = await this.post<RelayerGenericResponse>("completeRequest", body);
      return {
        success: resp.success !== false,
        txHash: resp.tx_hash as string | undefined,
        error: resp.error,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error completing request",
      };
    }
  }

  async getAccountSalt(params: {
    controllerEthAddr: string;
    guardianEmailAddr: string;
  }): Promise<string | null> {
    const body = {
      controller_eth_addr: params.controllerEthAddr,
      guardian_email_addr: params.guardianEmailAddr,
    };

    const resp = await this.post<RelayerSaltResponse>("getAccountSalt", body);
    return resp.account_salt ?? null;
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${normalizeBaseUrl(this.config.baseUrl)}/${endpoint}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

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
      throw new Error(`Relayer ${endpoint} returned ${resp.status}: ${text || resp.statusText}`);
    }

    return (await resp.json()) as T;
  }

  private mapStatus(
    raw: string | undefined,
  ): "pending" | "email_sent" | "email_received" | "proof_generated" | "failed" {
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
      default:
        return "pending";
    }
  }
}

type RelayerGenericResponse = {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
};

type RelayerRequestResponse = RelayerGenericResponse & {
  request_id?: string;
  requestId?: string;
  id?: string;
};

type RelayerStatusResponse = RelayerGenericResponse & {
  status?: string;
  email_auth_msg?: unknown;
  emailAuthMsg?: unknown;
};

type RelayerSaltResponse = RelayerGenericResponse & {
  account_salt?: string;
};
