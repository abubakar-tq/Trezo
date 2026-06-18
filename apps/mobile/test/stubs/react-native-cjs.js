/**
 * CJS stub for react-native — loaded via Module._resolveFilename hook in test/setup.cjs.
 * Covers all symbols that the test dependency chain touches.
 */
"use strict";

const Platform = {
  OS: "ios",
  select: (spec) => spec.ios ?? spec.native ?? spec.default,
};

const NativeModules = {};

const Appearance = {
  getColorScheme: () => "dark",
  addChangeListener: () => ({ remove: () => {} }),
};

const TurboModuleRegistry = {
  get: () => null,
  getEnforcing: () => ({}),
};

const NativeEventEmitter = class {
  constructor() {}
  addListener() { return { remove: () => {} }; }
  removeAllListeners() {}
};

const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
};

const noop = () => null;
const noopClass = class { render() { return null; } };

module.exports = {
  PixelRatio: { get: () => 3, getFontScale: () => 1, getPixelSizeForLayoutSize: (s) => s * 3, roundToNearestPixel: (s) => Math.round(s) },
  Platform,
  NativeModules,
  Appearance,
  TurboModuleRegistry,
  NativeEventEmitter,
  Dimensions,
  View: noop,
  Text: noop,
  TouchableOpacity: noop,
  Pressable: noop,
  TextInput: noop,
  Image: noop,
  Modal: noop,
  FlatList: noop,
  SectionList: noop,
  ScrollView: noop,
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
    absoluteFillObject: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  },
  Touchable: { Mixin: {} },
  PanResponder: { create: () => ({ panHandlers: {} }) },
  Animated: {
    Value: class { constructor() {} },
    View: noop,
    Text: noop,
    Image: noop,
    createAnimatedComponent: (c) => c,
    timing: () => ({ start: () => {} }),
    parallel: () => ({ start: () => {} }),
    sequence: () => ({ start: () => {} }),
  },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
};
