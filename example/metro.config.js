// Resolve @linksense-net/react-native from the parent folder (the package itself),
// and keep a single copy of react / react-native: the example's own.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);

config.watchFolders = [root];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.extraNodeModules = { '@linksense-net/react-native': root };
config.resolver.blockList = [
  ...Array.from(config.resolver.blockList ?? []),
  new RegExp(`${path.resolve(root, 'node_modules', 'react')}/`),
  new RegExp(`${path.resolve(root, 'node_modules', 'react-native')}/`),
  new RegExp(`${path.resolve(root, 'node_modules', 'expo')}/`),
];

module.exports = config;
