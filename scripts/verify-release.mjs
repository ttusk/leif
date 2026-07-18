import fs from "node:fs";

const requiredFiles = ["main.js", "manifest.json", "styles.css"];
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));

for (const file of requiredFiles) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error(`Missing release asset: ${file}`);
  }
}

if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error(`Invalid manifest version: ${manifest.version}`);
}

if (packageJson.version !== manifest.version) {
  throw new Error("package.json and manifest.json versions must match");
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error("versions.json must map the current plugin version to minAppVersion");
}

console.log(`Release ${manifest.version} is ready`);
