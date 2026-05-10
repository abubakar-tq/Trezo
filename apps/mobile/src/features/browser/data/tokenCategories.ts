export const TOKEN_CATEGORIES = [
  { id: "defi", label: "DeFi" },
  { id: "l2", label: "L2" },
  { id: "meme", label: "Memecoin" },
  { id: "stable", label: "Stablecoin" },
  { id: "gaming", label: "Gaming" },
  { id: "rwa", label: "RWA" },
] as const;

export type TokenCategoryId = (typeof TOKEN_CATEGORIES)[number]["id"];
