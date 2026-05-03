import type { SupportedChainId } from "@/src/integration/chains";
import type { Address } from "viem";

export type TokenType = "native" | "erc20";

export type BaseTokenMetadata = {
  chainId: SupportedChainId;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  isVerified: boolean;
  source: "builtin" | "deployment" | "custom";
};

export type NativeTokenMetadata = BaseTokenMetadata & {
  type: "native";
  address: "native";
};

export type Erc20TokenMetadata = BaseTokenMetadata & {
  type: "erc20";
  address: Address;
};

export type TokenMetadata = NativeTokenMetadata | Erc20TokenMetadata;

export type TokenKey = "native" | Address;
