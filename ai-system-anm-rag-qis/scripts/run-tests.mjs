/**
 * Responsabilidade do arquivo:
 * - Descobrir testes TypeScript (.test.ts/.spec.ts) sem depender de glob do shell.
 * - Executar o runner `tsx --test` com a lista real de arquivos.
 * - Garantir comportamento consistente em Windows/Linux/macOS.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const TESTS_DIR = path.resolve(ROOT, "tests");

function collectTestFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }
    if (entry.isFile() && (fullPath.endsWith(".test.ts") || fullPath.endsWith(".spec.ts"))) {
      files.push(fullPath);
    }
  }

  return files;
}

if (!statSync(TESTS_DIR, { throwIfNoEntry: false })) {
  console.error("tests directory not found");
  process.exit(1);
}

const testFiles = collectTestFiles(TESTS_DIR).sort();
if (!testFiles.length) {
  console.error("no .test.ts or .spec.ts files found");
  process.exit(1);
}

const tsxBin = path.resolve(
  ROOT,
  process.platform === "win32" ? "node_modules/.bin/tsx.cmd" : "node_modules/.bin/tsx",
);
const testGlobalsSetup = pathToFileURL(path.resolve(ROOT, "scripts/test-globals.mjs")).href;

const result = spawnSync(tsxBin, ["--import", testGlobalsSetup, "--test", ...testFiles], {
  stdio: "inherit",
  cwd: ROOT,
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
