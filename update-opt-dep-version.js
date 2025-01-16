const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;

if (packageJson.optionalDependencies) {
    for (const dep in packageJson.optionalDependencies) {
        packageJson.optionalDependencies[dep] = version;
    }
}

fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
console.log(`Updated optionalDependencies to version ${version}`);
