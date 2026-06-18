/**
 * CJS preload file for tsx tests.
 * Intercepts native-only package requires before esbuild tries to transform
 * their source (react-native uses Flow; @expo/vector-icons uses JSX in .js files).
 * Load via: node --require ./test/setup.cjs ...
 */
"use strict";

const Module = require("module");
const path = require("path");

const noop = () => null;

// @expo/vector-icons — ships JSX in .js files; esbuild can't transform them.
const EXPO_VECTOR_ICONS_STUB = {
  Feather: noop,
  Ionicons: noop,
  MaterialIcons: noop,
  FontAwesome: noop,
  AntDesign: noop,
};

// expo-haptics — device-only; no-op stub.
const EXPO_HAPTICS_STUB = {
  impactAsync: async () => {},
  notificationAsync: async () => {},
  selectionAsync: async () => {},
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
};

// expo-modules-core — provides Platform, requireNativeModule etc.
const EXPO_MODULES_CORE_STUB = {
  Platform: { OS: "ios", select: (spec) => spec.ios ?? spec.native ?? spec.default },
  UnavailabilityError: class UnavailabilityError extends Error {
    constructor(m, f) { super(`${m}.${f} is not available.`); this.name = "UnavailabilityError"; }
  },
  CodedError: class CodedError extends Error {
    constructor(code, msg) { super(msg); this.code = code; }
  },
  requireNativeModule: () => null,
  requireOptionalNativeModule: () => null,
  EventEmitter: class { addListener() { return { remove: () => {} }; } removeAllListeners() {} },
  NativeModule: class {},
  SharedObject: class {},
  SharedRef: class {},
};

// expo-secure-store — native keychain; no-op stub.
const EXPO_SECURE_STORE_STUB = {
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
  isAvailableAsync: async () => false,
  AFTER_FIRST_UNLOCK: 0,
  WHEN_UNLOCKED: 1,
  ALWAYS: 2,
};

// react-native-safe-area-context — native SafeAreaView; stub for tests.
const SAFE_AREA_CONTEXT_STUB = {
  SafeAreaView: noop,
  SafeAreaProvider: noop,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  SafeAreaInsetsContext: { Consumer: noop, Provider: noop },
};

// react-native-svg — native SVG renderer; no-op stub.
const REACT_NATIVE_SVG_STUB = new Proxy({}, {
  get: (_target, prop) => {
    if (prop === "__esModule") return true;
    if (prop === "default") return {};
    return noop;
  }
});

// Direct module stubs (exact request string → object to return)
const EXACT_STUBS = new Map([
  ["@expo/vector-icons", EXPO_VECTOR_ICONS_STUB],
  ["expo-haptics", EXPO_HAPTICS_STUB],
  ["expo-modules-core", EXPO_MODULES_CORE_STUB],
  ["expo-secure-store", EXPO_SECURE_STORE_STUB],
  ["react-native-safe-area-context", SAFE_AREA_CONTEXT_STUB],
  // react-native-svg handled by generic below but keep explicit for clarity
]);

// codegenNativeComponent sub-path — needs to export a function.
const codegenNativeComponentStub = { default: () => noop };

// Generic no-op proxy for any unknown native package.
// __esModule is intentionally NOT set to true so that __toESM wraps it as
// { default: genericNativeStub }, making all named and default imports work.
function makeNativeStub() {
  const stub = new Proxy(noop, {
    get: (_t, prop) => {
      if (prop === "__esModule") return false; // Let __toESM add default: mod
      if (prop === "Mixin") return {};
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === Symbol.iterator) return undefined;
      return stub; // All other property accesses return the stub itself
    },
    apply: () => stub,
    construct: () => ({}),
  });
  return stub;
}
const genericNativeStub = makeNativeStub();

// Packages that ship pre-compiled JSX or Flow .js files that esbuild can't transform,
// or that require native modules unavailable in Node. Wildcard stubs for these.
function isNativeOnlyPackage(request) {
  // Sub-paths of react-native
  if (request.startsWith("react-native/")) return true;
  // Known problematic packages
  const nativePackages = [
    "expo-linear-gradient",
    "expo-blur",
    "expo-image",
    "expo-av",
    "expo-camera",
    "expo-font",
    "expo-status-bar",
    "react-native-gesture-handler",
    "react-native-reanimated",
    "@react-native-community/",
    "react-native-svg",
    "@shopify/flash-list",
    "@shopify/react-native-skia",
    "expo-gl",
    "expo-three",
    "lottie-react-native",
    "react-native-skia",
  ];
  return nativePackages.some((pkg) => request === pkg || request.startsWith(pkg + "/"));
}

// Override Module._load to intercept all native-only packages.
const originalLoad = Module._load.bind(Module);
Module._load = function (request, parent, isMain) {
  // Exact package stubs (high-fidelity stubs for packages we know the API of)
  if (EXACT_STUBS.has(request)) {
    return EXACT_STUBS.get(request);
  }
  // react-native sub-path imports (e.g. react-native/Libraries/...)
  if (request.startsWith("react-native/")) {
    if (request.includes("codegenNativeComponent")) {
      return codegenNativeComponentStub;
    }
    return genericNativeStub;
  }
  // Other native-only packages
  if (isNativeOnlyPackage(request)) {
    return genericNativeStub;
  }
  return originalLoad(request, parent, isMain);
};

// Override Module._resolveFilename to redirect `react-native` itself to our CJS stub.
const originalResolve = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "react-native") {
    return require.resolve(path.resolve(__dirname, "stubs/react-native-cjs.js"));
  }
  return originalResolve(request, parent, isMain, options);
};
