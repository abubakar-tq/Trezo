import AccountFactory from "../abi/AccountFactory.json";
import EmailRecovery from "../abi/EmailRecovery.json";
import MinimalProxyFactory from "../abi/MinimalProxyFactory.json";
import PasskeyValidator from "../abi/PasskeyValidator.json";
import SmartAccount from "../abi/SmartAccount.json";
import SocialRecovery from "../abi/SocialRecovery.json";
import type { Abi } from "viem";

export const ABIS = {
  accountFactory: AccountFactory.abi as Abi,
  emailRecovery: EmailRecovery.abi as Abi,
  minimalProxyFactory: MinimalProxyFactory.abi as Abi,
  passkeyValidator: PasskeyValidator.abi as Abi,
  smartAccount: SmartAccount.abi as Abi,
  socialRecovery: SocialRecovery.abi as Abi,
} as const;

export type AbiName = keyof typeof ABIS;
