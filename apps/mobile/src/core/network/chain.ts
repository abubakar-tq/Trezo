import { Platform } from "react-native";

import { DEFAULT_CHAIN_ID, getChainConfig, type SupportedChainId } from "@/src/integration/chains";

export const CHAIN_CONFIG = {
  chainId: DEFAULT_CHAIN_ID,
  name: "Anvil",
  LAPTOP_IP: process.env.EXPO_PUBLIC_LAPTOP_IP || "10.70.81.26",
};

const getDisabledChainReason = (chainId: SupportedChainId): string => {
  const chain = getChainConfig(chainId);
  const missing: string[] = [];

  if (!chain.rpcUrl) missing.push("rpcUrl");
  if (!chain.bundlerUrl) missing.push("bundlerUrl");
  if (!chain.entryPoint) missing.push("entryPoint");
  if (!chain.accountFactory) missing.push("accountFactory");

  if (missing.length > 0) {
    return `missing ${missing.join(", ")}`;
  }

  return "isEnabled=false";
};

const requireEnabledChain = (chainId: SupportedChainId) => {
  const chain = getChainConfig(chainId);
  if (!chain.isEnabled) {
    throw new Error(`Chain ${chain.name} (${chainId}) is disabled: ${getDisabledChainReason(chainId)}.`);
  }
  return chain;
};

export const getRpcUrl = (chainId: SupportedChainId = DEFAULT_CHAIN_ID): string => {
  const chain = requireEnabledChain(chainId);
  if (!chain.rpcUrl) {
    throw new Error(`RPC URL missing for chain ${chain.name} (${chainId}).`);
  }
  return chain.rpcUrl;
};

export const getBundlerUrl = (chainId: SupportedChainId = DEFAULT_CHAIN_ID): string => {
  const chain = requireEnabledChain(chainId);
  if (!chain.bundlerUrl) {
    throw new Error(`Bundler URL missing for chain ${chain.name} (${chainId}).`);
  }
  return chain.bundlerUrl;
};

export const getPaymasterUrl = (chainId: SupportedChainId = DEFAULT_CHAIN_ID): string => {
  const chain = requireEnabledChain(chainId);
  if (!chain.paymasterUrl) {
    throw new Error(`Paymaster URL missing for chain ${chain.name} (${chainId}).`);
  }
  return chain.paymasterUrl;
};

export const logNetworkConfig = (chainId: SupportedChainId = DEFAULT_CHAIN_ID) => {
  const chain = getChainConfig(chainId);
  console.log("📡 [Chain Config]", {
    platform: Platform.OS,
    chainId,
    chainName: chain.name,
    environment: chain.environment,
    isEnabled: chain.isEnabled,
    rpcUrl: chain.rpcUrl,
    bundlerUrl: chain.bundlerUrl,
    paymasterUrl: chain.paymasterUrl,
    entryPoint: chain.entryPoint,
    accountFactory: chain.accountFactory,
  });
};
