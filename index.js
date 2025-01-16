const os = require("os");

const supportedPlatforms = ["linux", "darwin", "win32"];
const supportedArches = ["x64", "arm64"];

const platform = os.platform();
const arch = os.arch();

for (const platform of supportedPlatforms) {
    if (!supportedPlatforms.includes(platform)) {
        console.error(`Unsupported platform: ${platform}`);
        process.exit(1);
    }
}
for (const arch of supportedArches) {
    if (!supportedArches.includes(arch)) {
        console.error(`Unsupported arch: ${arch}`);
        process.exit(1);
    }
}
if (platform === "win32" && arch === "arm64") {
    console.error(`Unsupported platform-arch: ${platform}-${arch}`);
    process.exit(1);
}

let nativePackageName = `@rgb-tools/rgb-lib-${platform}-${arch}`;
module.exports = require(nativePackageName);
