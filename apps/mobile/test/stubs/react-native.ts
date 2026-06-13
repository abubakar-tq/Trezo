/**
 * Test stub for `react-native`.
 *
 * The real `react-native` package ships a Flow-typed `index.js` that esbuild
 * (used by `tsx`) cannot transform, so any test that transitively imports it
 * (e.g. via `networks.ts` / `chains.ts`, which read `Platform.OS`) blows up.
 *
 * Tests run under Node, not a device, so a minimal stub is all that is needed.
 * Aliased in via `tsconfig.test.json` paths — production builds (Metro) never
 * see this file.
 */
export const Platform = {
  OS: "ios" as "ios" | "android" | "web" | "windows" | "macos",
  select: <T,>(spec: { ios?: T; android?: T; native?: T; default?: T }): T | undefined =>
    spec.ios ?? spec.native ?? spec.default,
};

export const NativeModules: Record<string, unknown> = {};

export const Dimensions = {
  get: (_dim: "window" | "screen") => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
};

export default { Platform, NativeModules, Dimensions };
