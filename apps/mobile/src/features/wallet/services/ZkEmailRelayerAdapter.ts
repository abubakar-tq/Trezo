import type { Address, Hex } from "viem";

export type AcceptanceRequestParams = {
  controllerEthAddr: Address;
  guardianEmailAddr: string;
  templateIdx: number | bigint;
  command: string;
};

export type RecoveryEmailRequestParams = {
  controllerEthAddr: Address;
  guardianEmailAddr: string;
  templateIdx: number | bigint;
  command: string;
  chainId?: number;
};

export type RelayerRequestRef = {
  requestId: string;
  guardianEmail: string;
};

export type RelayerProofStatus =
  | "pending"
  | "email_sent"
  | "email_received"
  | "proof_generated"
  | "failed";

export type RelayerRequestStatus = {
  requestId: string;
  status: RelayerProofStatus;
  emailAuthMsg: EmailAuthMsgData | null;
  error: string | null;
};

export type EmailAuthMsgData = {
  templateId: bigint;
  commandParams: Hex[];
  skippedCommandPrefix: bigint;
  proof: EmailProofData;
};

export type EmailProofData = {
  domainName: string;
  publicKeyHash: Hex;
  timestamp: bigint;
  maskedCommand: string;
  emailNullifier: Hex;
  accountSalt: Hex;
  isCodeExist: boolean;
  proof: Hex;
};

export type SubmitProofToChainParams = {
  chainId: number;
  smartAccountAddress: Address;
  emailAuthMsg: EmailAuthMsgData;
  templateIdx: number | bigint;
  recoveryData: Hex;
  emailRecoveryModuleAddress: Address;
};

export type ChainSubmissionResult = {
  txHash: Hex | null;
  success: boolean;
  error: string | null;
};

export type CompleteRecoveryRequestParams = {
  chainId: number;
  smartAccountAddress: Address;
  recoveryData: Hex;
  emailRecoveryModuleAddress: Address;
};

export type CompleteRecoveryResult = {
  txHash: Hex | null;
  success: boolean;
  error: string | null;
};

export type ZkEmailRelayerConfig = {
  baseUrl: string;
  apiKey?: string;
  acceptanceTemplateIdx?: number;
  recoveryTemplateIdx?: number;
  proofMode: "per_chain" | "per_chain_hosted" | "reusable";
};

export interface ZkEmailRelayerAdapter {
  sendAcceptanceRequest(params: AcceptanceRequestParams): Promise<RelayerRequestRef>;
  sendRecoveryRequest(params: RecoveryEmailRequestParams): Promise<RelayerRequestRef>;
  getRequestStatus(requestId: string): Promise<RelayerRequestStatus>;
  submitProofToChain(params: SubmitProofToChainParams): Promise<ChainSubmissionResult>;
  completeRecovery(params: CompleteRecoveryRequestParams): Promise<CompleteRecoveryResult>;
}
