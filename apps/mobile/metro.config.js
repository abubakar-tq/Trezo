const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

function escapeRegExp(pattern) {
  if (pattern instanceof RegExp) {
    return pattern.source.replace(/\/|\\\//g, "\\" + path.sep);
  }
  if (typeof pattern === "string") {
    const escaped = pattern.replace(/[\-\[\]{}()\*+?.\\^$|]/g, "\\$&");
    return escaped.replace(/\//g, "\\" + path.sep);
  }
  throw new Error(
    `Expected exclusionList to be called with RegExp or string, got: ${typeof pattern}`,
  );
}

function exclusionList(additionalExclusions) {
  const list = [/\/__tests__\/.*$/];
  return new RegExp(
    "(" +
      (additionalExclusions || []).concat(list).map(escapeRegExp).join("|") +
      ")$",
  );
}

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Block any monorepo folders that should not be watched by Metro
const blockList = exclusionList([
  `${path.resolve(workspaceRoot, "contracts")}.*`,
]);

// 1. Watch only the mobile app and the workspace node_modules
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.blockList = blockList;
config.resolver.blacklistRE = blockList;

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
