export type SponsoredOperation =
  | "deploy"
  | "install-recovery"
  | "install-email"
  | "update-guardians"
  | "send"
  | "swap";

const TESTNET_CHAIN_IDS = new Set<number>([31337, 11155111, 84532, 421614]);

const MAINNET_SUBSIDIZED_OPS = new Set<SponsoredOperation>([
  "deploy",
  "install-recovery",
  "install-email",
]);

export function shouldSponsor(op: SponsoredOperation, chainId: number): boolean {
  if (TESTNET_CHAIN_IDS.has(chainId)) return true;
  return MAINNET_SUBSIDIZED_OPS.has(op);
}

if (__DEV__) {
  console.assert(shouldSponsor("update-guardians", 84532) === true, "Base Sepolia should sponsor guardian updates");
  console.assert(shouldSponsor("send", 84532) === true, "Base Sepolia should sponsor sends");
  console.assert(shouldSponsor("deploy", 8453) === true, "Base mainnet should sponsor deploy");
  console.assert(shouldSponsor("update-guardians", 8453) === false, "Base mainnet should NOT sponsor guardian updates");
  console.assert(shouldSponsor("send", 8453) === false, "Base mainnet should NOT sponsor sends");
}
