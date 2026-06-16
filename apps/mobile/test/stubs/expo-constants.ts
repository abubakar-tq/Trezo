/**
 * Test stub for `expo-constants`.
 *
 * `networks.ts` / `chains.ts` read `Constants.isDevice` at module-load time to
 * pick a localhost RPC host. Under `tsx` (Node) there is no device, so a flat
 * default is sufficient. Aliased in via `tsconfig.test.json`.
 */
const Constants = {
  isDevice: true,
  expoConfig: null as unknown,
  manifest: null as unknown,
};

export default Constants;
