const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const sourcePath = path.join(__dirname, "..", "lib", "knexchat", "nickname.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;

const sandbox = { module: { exports: {} }, exports: {}, require };
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(output, sandbox);

const { normalizeNickname, validateNickname, isReservedNickname } =
  sandbox.module.exports;

assert.equal(normalizeNickname("@User_Name"), "user_name");
assert.equal(normalizeNickname(" Joao.Silva "), "joao.silva");

assert.equal(validateNickname("ab").ok, false);
assert.equal(validateNickname("user..name").ok, false);
assert.equal(validateNickname("12345").ok, false);
assert.equal(validateNickname("john-doe").ok, false);
assert.equal(validateNickname("user_name").ok, true);

assert.equal(isReservedNickname("admin"), true);

console.log("knexchat nickname tests passed");
