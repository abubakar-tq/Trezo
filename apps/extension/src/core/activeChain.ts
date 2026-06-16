import { DEFAULT_CHAIN_ID, ENABLED_CHAIN_IDS, type ExtChainId } from "./networks";
const KEY = "trezo_active_chain_v1";
export async function getActiveChainId(): Promise<ExtChainId> {
  const out = await chrome.storage.local.get(KEY);
  const c = out[KEY] as ExtChainId | undefined;
  return c && ENABLED_CHAIN_IDS.includes(c) ? c : DEFAULT_CHAIN_ID;
}
export async function setActiveChainId(chainId: ExtChainId): Promise<void> {
  await chrome.storage.local.set({ [KEY]: chainId });
}
