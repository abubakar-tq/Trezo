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

export const Appearance = {
  getColorScheme: (): "light" | "dark" | null => "dark",
  addChangeListener: (_cb: unknown) => ({ remove: () => {} }),
};

export const TurboModuleRegistry = {
  get: (_name: string) => null,
  getEnforcing: (_name: string) => ({}),
};

export const NativeEventEmitter = class {
  constructor(_module?: unknown) {}
  addListener(_event: string, _listener: unknown) { return { remove: () => {} }; }
  removeAllListeners(_event: string) {}
};

export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
export const Pressable = () => null;

export const Dimensions = {
  get: (_dim: "window" | "screen") => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
};

// UI component stubs — enough to let modules that import them load under Node.
export const View = () => null;
export const Text = () => null;
export const TouchableOpacity = () => null;
export const TextInput = () => null;
export const Image = () => null;
export const Modal = () => null;
export const FlatList = () => null;
export const SectionList = () => null;
export const ScrollView = () => null;
export const StyleSheet = {
  create: <T extends Record<string, object>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
};

export default { Platform, NativeModules, Dimensions, View, Text, TouchableOpacity, TextInput, Image, Modal, FlatList, SectionList, ScrollView, StyleSheet };
