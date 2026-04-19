const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Allow Metro to do hierarchical lookup so nested node_modules (like viem's dependencies) are correctly resolved.
// config.resolver.disableHierarchicalLookup = true;

// Some web3 dependencies reference legacy subpaths (e.g. @noble/hashes/*). Disable strict package-exports
// enforcement so Metro resolves them directly without repeated warnings.
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: "./global.css" });
