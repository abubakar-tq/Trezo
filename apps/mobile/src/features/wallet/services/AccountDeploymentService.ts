import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, isPortableChain, type SupportedChainId } from "@/src/integration/chains";
import {
  buildCreateAccountUserOp,
  fundEntryPointDeposit,
  getDeployment,
  isContractDeployed,
  predictAccountAddress,
  submitConfiguredUserOp,
  type DeploymentMode,
  type PasskeyInit,
  waitForUserOperationReceipt,
} from "@/src/integration/viem";
import type { PasskeyMetadata } from "@/src/features/wallet/services/PasskeyService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import type { UserOperation, UserOperationReceipt } from "viem/account-abstraction";

export type CreateAccountBuildRequest = {
  passkey: PasskeyMetadata;
  walletId?: Hex;
  walletIndex?: bigint | number;
  mode?: DeploymentMode;
  validator?: Address;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  autoFundEntryPointDeposit?: boolean;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: bigint;
};

export type CreateAccountBuildResponse = {
  sender: Address;
  userOp?: UserOperation<"0.7">;
  userOpHash?: Hex;
  fundingTxHash?: Hex;
  alreadyDeployed?: boolean;
};

export type CreateAccountSubmitResponse = {
  accountAddress: Address;
  userOpHash?: Hex;
  transactionHash?: Hex;
  blockNumber?: number;
  receipt?: UserOperationReceipt<"0.7">;
  fundingTxHash?: Hex;
  alreadyDeployed?: boolean;
};

const normalizeCoordinate = (value: string): Hex =>
  (value.startsWith("0x") ? value : `0x${value}`) as Hex;

const toPasskeyInit = (passkey: PasskeyMetadata): PasskeyInit => {
  const px = normalizeCoordinate(passkey.publicKeyX);
  const py = normalizeCoordinate(passkey.publicKeyY);

  if (px.length !== 66 || py.length !== 66) {
    throw new Error("Stored passkey public key is invalid. Please recreate your passkey.");
  }

  return {
    idRaw: passkey.credentialIdRaw as Hex,
    px: BigInt(px),
    py: BigInt(py),
  };
};

export const deriveDefaultWalletId = (userId: string): Hex =>
  keccak256(toBytes(`trezo:wallet:${userId}`));

const resolveDeploymentMode = (chainId: SupportedChainId, requested?: DeploymentMode): DeploymentMode => {
  if (requested) return requested;
  return isPortableChain(chainId) ? "portable" : "chain-specific";
};

export class AccountDeploymentService {
  static toPasskeyInit(passkey: PasskeyMetadata): PasskeyInit {
    return toPasskeyInit(passkey);
  }

  static async predictAddress(
    walletId: Hex,
    passkey: PasskeyMetadata,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
    walletIndex: bigint | number = 0n,
    mode: DeploymentMode = resolveDeploymentMode(chainId),
    validator?: Address,
  ): Promise<Address> {
    const deployment = getDeployment(chainId);
    if (!deployment?.passkeyValidator) {
      throw new Error(`No passkey validator configured for chain ${chainId}`);
    }

    return predictAccountAddress(
      chainId,
      walletId,
      (validator ?? deployment.passkeyValidator) as Address,
      toPasskeyInit(passkey),
      walletIndex,
      mode,
    );
  }

  static async buildCreateAccountUserOp(
    params: CreateAccountBuildRequest,
  ): Promise<CreateAccountBuildResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const usePaymaster = params.usePaymaster ?? Boolean(params.paymasterUrl);
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl(chainId)
      : params.paymasterUrl;
    const deployment = getDeployment(chainId);

    if (!deployment?.passkeyValidator) {
      throw new Error(`No passkey validator configured for chain ${chainId}`);
    }
    if (!deployment.accountFactory || !deployment.entryPoint) {
      throw new Error(`No account factory or entry point configured for chain ${chainId}`);
    }

    const walletIndex = BigInt(params.walletIndex ?? 0n);
    const walletId = params.walletId;
    if (!walletId) {
      throw new Error("walletId is required for deterministic account deployment.");
    }

    const mode = resolveDeploymentMode(chainId, params.mode);
    if (mode === "portable" && !isPortableChain(chainId)) {
      throw new Error(`Chain ${chainId} is not supported for portable wallet deployment.`);
    }

    const passkeyInit = toPasskeyInit(params.passkey);
    const validator = (params.validator ?? deployment.passkeyValidator) as Address;
    const sender = await predictAccountAddress(chainId, walletId, validator, passkeyInit, walletIndex, mode);

    if (await isContractDeployed(chainId, sender)) {
      return {
        sender,
        alreadyDeployed: true,
      };
    }

    let fundingTxHash: Hex | undefined;
    if ((params.autoFundEntryPointDeposit ?? !usePaymaster) && !usePaymaster) {
      const { hash } = await fundEntryPointDeposit({
        chainId,
        account: sender,
        amountEth: 0.05,
      });
      fundingTxHash = hash as Hex;
    }

    const { userOp, userOpHash } = await buildCreateAccountUserOp({
      chainId,
      walletId,
      walletIndex,
      mode,
      validator,
      passkeyInit,
      bundlerUrl,
      paymasterUrl,
      usePaymaster,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      nonce: params.nonce,
    });

    return {
      sender: sender as Address,
      userOp,
      userOpHash,
      fundingTxHash,
    };
  }

  static async signCreateAccountUserOp(
    userId: string,
    userOpHash: Hex,
  ): Promise<Hex> {
    const signature = await PasskeyService.signWithPasskey(userId, userOpHash);
    return PasskeyService.encodeSignatureForContract(signature) as Hex;
  }

  static async deployWithPasskeyAuth(
    userId: string,
    params: CreateAccountBuildRequest,
  ): Promise<CreateAccountSubmitResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const built = await this.buildCreateAccountUserOp(params);

    if (built.alreadyDeployed) {
      return {
        accountAddress: built.sender,
        alreadyDeployed: true,
      };
    }

    if (!built.userOp || !built.userOpHash) {
      throw new Error("Create-account build did not produce a UserOperation.");
    }

    const signature = await this.signCreateAccountUserOp(userId, built.userOpHash);
    const signedUserOp = { ...built.userOp, signature };
    const userOpHash = await submitConfiguredUserOp(signedUserOp, chainId, bundlerUrl);
    const receipt = await waitForUserOperationReceipt(userOpHash, chainId, bundlerUrl);

    return {
      accountAddress: built.sender,
      userOpHash,
      transactionHash: receipt.receipt.transactionHash,
      blockNumber: Number(receipt.receipt.blockNumber),
      receipt,
      fundingTxHash: built.fundingTxHash,
    };
  }
}
