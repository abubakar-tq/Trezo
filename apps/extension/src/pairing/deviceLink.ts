import { getPublicClient } from "../core/clients";
import { getNetwork } from "../core/networks";
import { ABIS } from "../core/abis";

/**
 * Returns true if credentialIdRaw (bytes32 hex) is registered in this chain's
 * PasskeyValidator for the given account.
 */
export async function isDeviceLinkedOnChain(
  chainId: number,
  account: `0x${string}`,
  credentialIdRaw: `0x${string}`,
): Promise<boolean> {
  let validator: `0x${string}` | undefined;
  try {
    validator = getNetwork(chainId).deployment.passkeyValidator as `0x${string}` | undefined;
  } catch {
    return false;
  }
  if (!validator) return false;
  const client = getPublicClient(chainId);
  let count: bigint;
  try {
    count = (await client.readContract({
      address: validator,
      abi: ABIS.passkeyValidator,
      functionName: "passkeyCount",
      args: [account],
    })) as bigint;
  } catch {
    return false;
  }
  if (count === 0n) return false;

  // Fetch all registered passkey IDs in parallel instead of sequentially.
  const indices = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
  const raws = await Promise.all(
    indices.map((i) =>
      (client.readContract({
        address: validator,
        abi: ABIS.passkeyValidator,
        functionName: "passkeyAt",
        args: [account, i],
      }) as Promise<string>).catch(() => null),
    ),
  );
  return raws.some(
    (raw) => raw != null && raw.toLowerCase() === credentialIdRaw.toLowerCase(),
  );
}
