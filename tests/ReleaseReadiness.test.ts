import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), "utf8");

describe("community release readiness", () => {
  it("keeps release metadata synchronized and useful in the community directory", () => {
    const manifest = JSON.parse(read("manifest.json")) as Record<string, unknown>;
    const packageJson = JSON.parse(read("package.json")) as Record<string, unknown>;
    const versions = JSON.parse(read("versions.json")) as Record<string, unknown>;
    const version = manifest.version as string;

    expect(packageJson.version).toBe(version);
    expect(versions[version]).toBe(manifest.minAppVersion);
    expect(manifest.description).not.toBe("A bússola do seu estudo.");
    expect(manifest.authorUrl).toBe("https://github.com/ttusk");
    expect(read("README.md")).toContain("## Instalação");
    expect(read("README.md")).toContain("## Como usar");
  });

  it("uses APIs and DOM patterns supported by the declared Obsidian version", () => {
    const viewRegistration = read("src/ui/view/registerLeifView.ts");
    const domHelpers = read("src/ui/view/shared/DomHelpers.ts");

    expect(viewRegistration).not.toContain("workspace.revealLeaf");
    expect(domHelpers).not.toContain("document.createElement");
    expect(domHelpers).not.toMatch(/addEventListener\([^,]+,\s*options\.onClick\)/);
  });

  it("keeps demo and compiled artifacts out of the source repository", () => {
    expect(existsSync(resolve(root, "sample-vault/.obsidian/plugins/leif/main.js"))).toBe(false);
    expect(existsSync(resolve(root, "docs/improvements-audit.md"))).toBe(false);
    expect(existsSync(resolve(root, "docs/product-overview.md"))).toBe(false);
    expect(existsSync(resolve(root, "scripts/generate-sample-data.mjs"))).toBe(false);
    expect(existsSync(resolve(root, "src/ui/commands/registerCommands.ts"))).toBe(false);
    expect(existsSync(resolve(root, "src/infrastructure/persistence/Seeder.ts"))).toBe(false);
    expect(existsSync(resolve(root, "src/application/use-cases/ExportToCsvUseCase.ts"))).toBe(
      false
    );
    expect(existsSync(resolve(root, "src/domain/services/CsvExportService.ts"))).toBe(false);
    expect(existsSync(resolve(root, "tests/ui/registerCommands.test.ts"))).toBe(false);
    expect(read(".gitignore")).toMatch(/^main\.js$/m);
  });

  it("builds minimized release assets and publishes them from version tags", () => {
    const buildConfig = read("esbuild.config.mjs");
    const workflow = read(".github/workflows/ci.yml");

    expect(buildConfig).toContain('outfile: "main.js"');
    expect(buildConfig).toContain("minify: isProduction");
    expect(workflow).toMatch(/tags:\s*\["\*"\]/);
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("softprops/action-gh-release@v2");
    expect(workflow).toContain("main.js");
  });
});
