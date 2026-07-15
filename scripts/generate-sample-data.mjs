import esbuild from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = path.resolve("sample-vault/.obsidian/plugins/leif/data.json");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "leif-sample-data-"));
const entryPath = path.join(tempDir, "generate.ts");
const bundlePath = path.join(tempDir, "generate.mjs");

fs.writeFileSync(
  entryPath,
  `
    import fs from "node:fs";
    import { createDefaultLeifPluginData, type LeifPluginData } from "@/domain/types/LeifPluginData";
    import { seedTceSpDemo } from "@/infrastructure/persistence/Seeder";

    class InMemoryPluginDataStore {
      private data: LeifPluginData = createDefaultLeifPluginData();

      async load(): Promise<LeifPluginData> {
        return this.data;
      }

      async save(data: LeifPluginData): Promise<void> {
        this.data = data;
      }
    }

    const store = new InMemoryPluginDataStore();
    await seedTceSpDemo(store);
    const data = await store.load();
    fs.writeFileSync(${JSON.stringify(outputPath)}, JSON.stringify(data, null, 2) + "\\n");
  `
);

try {
  await esbuild.build({
    entryPoints: [entryPath],
    absWorkingDir: process.cwd(),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    tsconfig: path.resolve("tsconfig.json"),
    outfile: bundlePath,
    logLevel: "silent"
  });

  await import(pathToFileURL(bundlePath).href);
  console.log(`Generated ${outputPath}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
