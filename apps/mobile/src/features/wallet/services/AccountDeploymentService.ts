import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  buildCreateAccountUserOp,
  fundEntryPointDeposit,
  getDeployment,
  isContractDeployed,
  predictAccountAddress,
  submitConfiguredUserOp,
  type PasskeyInit,
  waitForUserOperationReceipt,
} from "@/src/integration/viem";
import type { PasskeyMetadata } from "@/src/features/wallet/services/PasskeyService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import type { Address, Hex } from "viem";
import type { UserOperation, UserOperationReceipt } from "viem/account-abstraction";

export type CreateAccountBuildRequest = {
  passkey: PasskeyMetadata;
  chainId?: SupportedChainId;
  salt?: Hex;
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

export class AccountDeploymentService {
  static toPasskeyInit(passkey: PasskeyMetadata): PasskeyInit {
    return toPasskeyInit(passkey);
  }

  static async predictAddress(
    passkey: Pick<PasskeyMetadata, "credentialIdRaw">,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
    salt?: Hex,
  ): Promise<Address> {
    return predictAccountAddress(chainId, (salt ?? passkey.credentialIdRaw) as Hex);
  }

  static async buildCreateAccountUserOp(
    params: CreateAccountBuildRequest,
  ): Promise<CreateAccountBuildResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl()
      : params.paymasterUrl;
    const deployment = getDeployment(chainId);

    if (!deployment?.passkeyValidator) {
      throw new Error(`No passkey validator configured for chain ${chainId}`);
    }

    const salt = (params.salt ?? params.passkey.credentialIdRaw) as Hex;
    const passkeyInit = toPasskeyInit(params.passkey);
    const sender = await predictAccountAddress(chainId, salt);

    if (await isContractDeployed(chainId, sender)) {
      return {
        sender,
        alreadyDeployed: true,
      };
    }

    let fundingTxHash: Hex | undefined;
    if ((params.autoFundEntryPointDeposit ?? !params.usePaymaster) && !params.usePaymaster) {
      const { hash } = await fundEntryPointDeposit({
        chainId,
        account: sender,
        amountEth: 0.05,
      });
      fundingTxHash = hash as Hex;
    }

    const { userOp, userOpHash } = await buildCreateAccountUserOp({
      chainId,
      salt,
      validator: deployment.passkeyValidator,
      passkeyInit,
      bundlerUrl,
      paymasterUrl,
      usePaymaster: params.usePaymaster,
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
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
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
