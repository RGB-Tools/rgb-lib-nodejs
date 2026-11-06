// load the installed package from the project root and call the native addon
const path = require("path");

const rgblib = require(path.resolve("."));
const keys = rgblib.generateKeys(
    rgblib.BitcoinNetwork.Regtest,
    rgblib.WitnessVersion.Taproot,
);
if (!keys.mnemonic) {
    throw new Error("generateKeys returned no mnemonic");
}
console.log("native addon loaded, keys generated");
