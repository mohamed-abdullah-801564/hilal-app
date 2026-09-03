const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Firebase v10+ uses the `exports` field in package.json for conditional exports
// (browser vs node vs react-native). Metro must be told to respect this.
config.resolver = {
  ...(config.resolver ?? {}),
  unstable_enablePackageExports: true,
  // Block pnpm temp dirs created during Firebase package installation
  blockList: [
    /_tmp_\d+/,
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
      ? [config.resolver.blockList]
      : []),
  ],
};

module.exports = config;
