import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  ABIS,
  buildInstallRecoveryModuleUserOp,
  encodeEmailRecoveryInitData,
  getPublicClient,
  getDeployment,
  isExecutorModuleInstalled,
  submitConfiguredUserOp,
} from "@/src/integration/viem";
import * as SecureStore from "expo-secure-store";
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

export type EmailRecoveryInstallRequest = {
  smartAccountAddress: Address;
  guardians: readonly Address[];
  weights?: readonly (number | bigint)[];
  threshold: number | bigint;
  delay: number | bigint;
  expiry: number | bigint;
  passkeyId: Hex;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  nonce?: bigint;
  nonceKey?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
};

export type EmailRecoveryInstallResponse = {
  userOp: UserOperation<"0.7">;
  userOpHash: Hex;
};

export type EmailRecoverySubmitRequest = {
  signedUserOp: UserOperation<"0.7">;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
};

export type DerivedGuardianAddress = {
  email: string;
  accountSalt: Hex;
  guardianAddress: Address;
};

export type EmailRecoveryTemplate = {
  guardianEmails: string[];
  guardianWeights: number[];
  threshold: number;
  delayDays: number;
  expiryDays: number;
  updatedAt: string;
};

const normalizeGuardianEmail = (email: string) => email.trim().toLowerCase();

const templateStorageKey = (userId: string, smartAccountAddress: Address) =>
  `trezo_email_recovery_template:${userId}:${smartAccountAddress.toLowerCase()}`;

export class EmailRecoveryService {
  static normalizeGuardianEmail(email: string): string {
    return normalizeGuardianEmail(email);
  }

  static guardianEmailToAccountSalt(email: string): Hex {
    const normalizedEmail = normalizeGuardianEmail(email);
    if (!normalizedEmail) {
      throw new Error("Guardian email is required to derive the EmailAuth guardian address");
    }
    return keccak256(stringToHex(normalizedEmail));
  }

  static async deriveGuardianAddresses(
    smartAccountAddress: Address,
    guardianEmails: readonly string[],
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<DerivedGuardianAddress[]> {
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }

    const publicClient = getPublicClient(chainId);
    return Promise.all(
      guardianEmails.map(async (email) => {
        const normalizedEmail = normalizeGuardianEmail(email);
        const accountSalt = this.guardianEmailToAccountSalt(normalizedEmail);
        const guardianAddress = await publicClient.readContract({
          address: deployment.emailRecovery as Address,
          abi: ABIS.emailRecovery,
          functionName: "computeEmailAuthAddress",
          args: [smartAccountAddress, accountSalt],
        });

        return {
          email: normalizedEmail,
          accountSalt,
          guardianAddress: guardianAddress as Address,
        } satisfies DerivedGuardianAddress;
      }),
    );
  }

  static async saveTemplate(
    userId: string,
    smartAccountAddress: Address,
    template: Omit<EmailRecoveryTemplate, "updatedAt">,
  ): Promise<void> {
    const normalizedEmails = template.guardianEmails.map((email) => normalizeGuardianEmail(email)).filter(Boolean);
    const payload: EmailRecoveryTemplate = {
      ...template,
      guardianEmails: normalizedEmails,
      updatedAt: new Date().toISOString(),
    };

    await SecureStore.setItemAsync(templateStorageKey(userId, smartAccountAddress), JSON.stringify(payload), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  static async loadTemplate(
    userId: string,
    smartAccountAddress: Address,
  ): Promise<EmailRecoveryTemplate | null> {
    const raw = await SecureStore.getItemAsync(templateStorageKey(userId, smartAccountAddress));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as EmailRecoveryTemplate;
      if (!Array.isArray(parsed.guardianEmails) || !Array.isArray(parsed.guardianWeights)) return null;
      if (
        typeof parsed.threshold !== "number" ||
        typeof parsed.delayDays !== "number" ||
        typeof parsed.expiryDays !== "number"
      ) {
        return null;
      }
      return {
        ...parsed,
        guardianEmails: parsed.guardianEmails.map((e) => normalizeGuardianEmail(e)).filter(Boolean),
      };
    } catch {
      return null;
    }
  }

  static async clearTemplate(userId: string, smartAccountAddress: Address): Promise<void> {
    await SecureStore.deleteItemAsync(templateStorageKey(userId, smartAccountAddress));
  }

  static encodeInitData(
    guardians: readonly Address[],
    weights: readonly (number | bigint)[],
    threshold: number | bigint,
    delay: number | bigint,
    expiry: number | bigint,
  ): Hex {
    return encodeEmailRecoveryInitData(guardians, weights, threshold, delay, expiry);
  }

  static async buildInstallModuleUserOp(
    params: EmailRecoveryInstallRequest,
  ): Promise<EmailRecoveryInstallResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl()
      : params.paymasterUrl;
    const weights = params.weights ?? params.guardians.map(() => 1n);
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }
    const initData = encodeEmailRecoveryInitData(
      params.guardians,
      weights,
      params.threshold,
      params.delay,
      params.expiry,
    );

    const { userOp, userOpHash } = await buildInstallRecoveryModuleUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      moduleAddress: deployment.emailRecovery as Address,
      initData,
      passkeyId: params.passkeyId,
      nonce: params.nonce,
      nonceKey: params.nonceKey,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      callGasLimit: params.callGasLimit,
      verificationGasLimit: params.verificationGasLimit ?? 1_200_000n,
      preVerificationGas: params.preVerificationGas ?? 120_000n,
      operationLabel: "buildInstallEmailRecoveryUserOp",
    });

    return { userOp, userOpHash };
  }

  static async submitInstallModuleUserOp(params: EmailRecoverySubmitRequest): Promise<Hex> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    if (!params.signedUserOp.signature || params.signedUserOp.signature === "0x") {
      throw new Error("Signed UserOperation must include a signature before submission");
    }
    return submitConfiguredUserOp(params.signedUserOp, chainId, bundlerUrl);
  }

  static async isModuleInstalled(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<boolean> {
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }
    return isExecutorModuleInstalled({
      chainId,
      smartAccountAddress,
      moduleAddress: deployment.emailRecovery as Address,
    });
  }
}
