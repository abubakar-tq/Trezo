import smartAccountJson from "./SmartAccount.json";
import accountFactoryJson from "./AccountFactory.json";
import passkeyValidatorJson from "./PasskeyValidator.json";
import socialRecoveryJson from "./SocialRecovery.json";

export const ABIS = {
  smartAccount: smartAccountJson.abi as unknown as import("viem").Abi,
  accountFactory: accountFactoryJson.abi as unknown as import("viem").Abi,
  passkeyValidator: passkeyValidatorJson.abi as unknown as import("viem").Abi,
  socialRecovery: socialRecoveryJson.abi as unknown as import("viem").Abi,
};
