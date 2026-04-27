/**
 * @file run-tests.mjs
 * @description Descobre e executa testes TypeScript sem depender de glob ou limite curto do shell.
 * @layer tests
 * @purpose Garantir execucao estavel da suite de antirregressao em Windows, Linux e macOS.
 * @inputs Diretorio tests com arquivos .test.ts e .spec.ts.
 * @outputs Execucao TAP do runner tsx --test e codigo de saida agregado.
 * @dependsOn node:fs, node:path, node:url, node:child_process e tsx.
 * @usedBy npm test.
 * @invariants O runner nao deve depender de shell expansion nem montar linha de comando maior que o limite do Windows.
 * @notes Os testes sao executados em lotes para evitar erro "A sintaxe do comando esta incorreta" no cmd.exe.
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

const tsxCli = path.resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const testGlobalsSetup = pathToFileURL(path.resolve(ROOT, "scripts/test-globals.mjs")).href;
const maxBatchArgChars = process.platform === "win32" ? 12000 : 60000;

function buildTestBatches(files) {
  const batches = [];
  let current = [];
  let currentSize = 0;

  for (const file of files) {
    const nextSize = currentSize + file.length + 1;
    if (current.length > 0 && nextSize > maxBatchArgChars) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }

    current.push(file);
    currentSize += file.length + 1;
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

for (const batch of buildTestBatches(testFiles)) {
  const result = spawnSync(
    process.execPath,
    [tsxCli, "--import", testGlobalsSetup, "--test", ...batch],
    {
      stdio: "inherit",
      cwd: ROOT,
      shell: false,
    },
  );

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

process.exit(0);
