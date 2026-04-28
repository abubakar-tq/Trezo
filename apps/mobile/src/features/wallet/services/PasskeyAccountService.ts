import AsyncStorage from "@react-native-async-storage/async-storage";

import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  buildAddPasskeyUserOp,
  buildRemovePasskeyUserOp,
  getDeployment,
  sendUserOp,
  type PasskeyInit,
} from "@/src/integration/viem";
import type {
  AddPasskeyUserOpParams,
  RemovePasskeyUserOpParams,
} from "@/src/integration/viem/userOps";
import type { PasskeyMetadata } from "./PasskeyService";
import type { Address, Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

const STORAGE_PREFIX = "trezo_pending_passkeys_v1_";

export type PendingPasskeyRecord = {
  idRaw: Hex;
  credentialId: string;
  px: string;
  py: string;
  deviceName?: string;
  deviceType?: string;
  createdAt: string;
};

export type AddPasskeyBuildRequest = {
  smartAccountAddress: Address;
  pendingPasskey: PendingPasskeyRecord;
  signingPasskeyId: Hex;
  validatorAddress?: Address;
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

export type RemovePasskeyBuildRequest = {
  smartAccountAddress: Address;
  passkeyIdToRemove: Hex;
  signingPasskeyId: Hex;
  validatorAddress?: Address;
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

export type PasskeyUserOpResponse = {
  userOp: UserOperation<"0.7">;
  userOpHash: Hex;
};

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const normalizeHex = (value: string): string => (value.startsWith("0x") ? value : `0x${value}`);

const toPasskeyInit = (record: PendingPasskeyRecord): PasskeyInit => ({
  idRaw: record.idRaw,
  px: BigInt(normalizeHex(record.px)),
  py: BigInt(normalizeHex(record.py)),
});

export class PasskeyAccountService {
  static async enqueuePendingPasskey(userId: string, metadata: PasskeyMetadata): Promise<void> {
    const pending = await this.listPendingPasskeys(userId);
    const record: PendingPasskeyRecord = {
      idRaw: metadata.credentialIdRaw as Hex,
      credentialId: metadata.credentialId,
      px: normalizeHex(metadata.publicKeyX),
      py: normalizeHex(metadata.publicKeyY),
      deviceName: metadata.deviceName,
      deviceType: metadata.deviceType,
      createdAt: metadata.createdAt,
    };
    const filtered = pending.filter((item) => item.idRaw !== record.idRaw);
    filtered.unshift(record);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(filtered));
  }

  static async listPendingPasskeys(userId: string): Promise<PendingPasskeyRecord[]> {
    const json = await AsyncStorage.getItem(storageKey(userId));
    if (!json) return [];
    try {
      const parsed = JSON.parse(json) as PendingPasskeyRecord[];
      return parsed;
    } catch {
      await AsyncStorage.removeItem(storageKey(userId));
      return [];
    }
  }

  static async removePendingPasskey(userId: string, idRaw: Hex): Promise<void> {
    const pending = await this.listPendingPasskeys(userId);
    const updated = pending.filter((item) => item.idRaw !== idRaw);
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(updated));
  }

  static async buildAddPasskeyUserOp(params: AddPasskeyBuildRequest): Promise<PasskeyUserOpResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl()
      : params.paymasterUrl;

    const passkey = toPasskeyInit(params.pendingPasskey);

    const { userOp, userOpHash } = await buildAddPasskeyUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      newPasskey: passkey,
      signingPasskeyId: params.signingPasskeyId,
      validatorAddress: params.validatorAddress,
      nonce: params.nonce,
      nonceKey: params.nonceKey,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      callGasLimit: params.callGasLimit,
      verificationGasLimit: params.verificationGasLimit,
      preVerificationGas: params.preVerificationGas,
    } satisfies AddPasskeyUserOpParams);

    return { userOp, userOpHash };
  }

  static async buildRemovePasskeyUserOp(
    params: RemovePasskeyBuildRequest,
  ): Promise<PasskeyUserOpResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl()
      : params.paymasterUrl;

    const { userOp, userOpHash } = await buildRemovePasskeyUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      passkeyIdToRemove: params.passkeyIdToRemove,
      signingPasskeyId: params.signingPasskeyId,
      validatorAddress: params.validatorAddress,
      nonce: params.nonce,
      nonceKey: params.nonceKey,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      callGasLimit: params.callGasLimit,
      verificationGasLimit: params.verificationGasLimit,
      preVerificationGas: params.preVerificationGas,
    } satisfies RemovePasskeyUserOpParams);

    return { userOp, userOpHash };
  }

  static async submitAddPasskeyUserOp(
    signedUserOp: UserOperation<"0.7">,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
    bundlerUrl: string = getBundlerUrl(),
    entryPoint?: Hex,
  ): Promise<Hex> {
    if (!signedUserOp.signature || signedUserOp.signature === "0x") {
      throw new Error("Signed UserOperation must include a signature");
    }
    if (!entryPoint) {
      const deployment = getDeployment(chainId);
      if (!deployment?.entryPoint) {
        throw new Error(`No entry point configured for chain ${chainId}`);
      }
      entryPoint = deployment.entryPoint;
    }
    return sendUserOp(signedUserOp, chainId, bundlerUrl, entryPoint);
  }
}
