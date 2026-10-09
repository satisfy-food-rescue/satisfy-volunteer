// The app imports packages/core (dates, labels, the API contract) through a
// pnpm link, so Metro has to watch that folder as well as this project.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../packages/core")];

module.exports = config;
