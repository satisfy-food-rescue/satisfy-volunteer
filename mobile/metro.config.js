// The app imports packages/core (dates, labels, the API contract) through a
// pnpm link, so Metro has to watch that folder as well as this project.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

// The server the app talks to comes from an EAS environment variable
// (`eas env:create`); in development it defaults to the Metro host
// (src/lib/config.ts). A release build (EAS_BUILD_PROFILE) or OTA update
// (RELEASE_CHANNEL, set by the update:* scripts) bundled without it would point
// every installed app at localhost, so refuse. This check lives here rather
// than in app.config.ts because `eas update` reads the app config before it
// loads the EAS environment, while Metro only runs once it is in place.
const release = process.env.EAS_BUILD_PROFILE ?? process.env.RELEASE_CHANNEL;
if (release && release !== "development" && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error(`EXPO_PUBLIC_API_URL must be set for ${release}. Add it with \`eas env:create\` (see README).`);
}

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../packages/core")];

module.exports = config;
