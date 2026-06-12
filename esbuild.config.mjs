import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const isProduction = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*"],
  format: "cjs",
  target: "es2020",
  sourcemap: isProduction ? false : "inline",
  treeShaking: true,
  outfile: "dist/main.js",
  logLevel: "info"
});

function copyToSampleVault() {
  const vaultPluginDir = path.resolve("sample-vault/.obsidian/plugins/corvo");
  if (fs.existsSync(vaultPluginDir)) {
    fs.copyFileSync("dist/main.js", path.join(vaultPluginDir, "main.js"));
    fs.copyFileSync("styles.css", path.join(vaultPluginDir, "styles.css"));
    console.log("Copied to sample vault");
  }
}

if (isProduction) {
  await context.rebuild();
  copyToSampleVault();
  await context.dispose();
} else {
  await context.watch();
}

