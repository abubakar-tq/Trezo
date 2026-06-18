import { resolveMoralisApiKey } from "./web3Data";

export const fetchMoralisHistoricalTransfers = async (walletAddress: string, chainId: number) => {
  // Moralis does not index local Anvil. Ignore safely.
  if (chainId === 31337) return { native: [], erc20: [] };

  const apiKey = resolveMoralisApiKey();
  if (!apiKey) {
    console.warn("⚠️ Cannot fetch historical transfers: Moralis API key missing.");
    return { native: [], erc20: [] };
  }

  const hexChainId = `0x${chainId.toString(16)}`;

  try {
    const headers = {
      accept: "application/json",
    };

    // 1. Fetch Native ETH Transfers (e.g. sent ETH before deployment)
    const nativeResponsePromise = fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}?chain=${hexChainId}`,
      { headers }
    );

    // 2. Fetch ERC-20 Token Transfers (e.g. sent USDC before deployment)
    const erc20ResponsePromise = fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers?chain=${hexChainId}`,
      { headers }
    );

    const [nativeRes, erc20Res] = await Promise.all([nativeResponsePromise, erc20ResponsePromise]);

    let native = [];
    let erc20 = [];

    // Safely parse JSON if response is OK. Otherwise ignore (e.g., if chain is unsupported like Arb Sepolia)
    if (nativeRes.ok) {
      const nativeData = await nativeRes.json();
      native = nativeData.result || [];
    }

    if (erc20Res.ok) {
      const erc20Data = await erc20Res.json();
      erc20 = erc20Data.result || [];
    }

    return { native, erc20 };
  } catch (error) {
    console.warn(`[Moralis] Failed to fetch historical transfers for ${walletAddress} on ${chainId}:`, error);
    return { native: [], erc20: [] };
  }
};
