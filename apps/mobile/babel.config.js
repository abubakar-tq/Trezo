module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          blocklist: null,
          allowlist: null,
          safe: false,
          allowUndefined: true,
        },
      ],
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
            "@app": "./src/app",
            "@features": "./src/features",
            "@shared": "./src/shared",
            "@theme": "./src/theme",
            "@types": "./src/types",
            "@lib": "./src/lib",
            "@store": "./src/store",
            "@utils": "./src/utils",
            "@hooks": "./src/shared/hooks",
            "@services": "./src/services",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
