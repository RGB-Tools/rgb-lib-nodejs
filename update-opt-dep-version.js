const fs = require("fs");

// with --check, only verify optionalDependencies match the package version
const checkOnly = process.argv.includes("--check");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;

const mismatched = [];
if (packageJson.optionalDependencies) {
    for (const dep in packageJson.optionalDependencies) {
        if (packageJson.optionalDependencies[dep] !== version) {
            mismatched.push(`${dep}@${packageJson.optionalDependencies[dep]}`);
        }
        packageJson.optionalDependencies[dep] = version;
    }
}

if (checkOnly) {
    if (mismatched.length) {
        console.error(
            `optionalDependencies not matching version ${version}: ${mismatched.join(", ")}`,
        );
        console.error("run `node update-opt-dep-version.js` to fix");
        process.exit(1);
    }
    console.log(`optionalDependencies match version ${version}`);
    process.exit(0);
}

fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
console.log(`Updated optionalDependencies to version ${version}`);
