export function toHex(value: `0x${string}` | string): `0x${string}` {
  return value as `0x${string}`;
}

export function blockTimestampToBigint(ts: bigint | number): bigint {
  return typeof ts === "bigint" ? ts : BigInt(ts);
}
