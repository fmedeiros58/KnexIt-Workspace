/**
 * Responsabilidade do arquivo:
 * - Precarregar globals compativeis com a suite mista (node:test + estilo jest leve).
 * - Evitar falhas silenciosas do harness por ausencia de describe/it/test/expect.
 */
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
  test,
} from "node:test";
import assert from "node:assert/strict";

function formatValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildAssertionError(message) {
  return new Error(message);
}

function createMatchers(received, invert = false) {
  function verify(condition, message) {
    if (invert ? condition : !condition) {
      throw buildAssertionError(message);
    }
  }

  return {
    toBe(expected) {
      verify(
        Object.is(received, expected),
        `expected ${formatValue(received)} ${invert ? "not " : ""}to be ${formatValue(expected)}`,
      );
    },
    toEqual(expected) {
      let matches = true;
      try {
        assert.deepStrictEqual(received, expected);
      } catch {
        matches = false;
      }
      verify(
        matches,
        `expected ${formatValue(received)} ${invert ? "not " : ""}to equal ${formatValue(expected)}`,
      );
    },
    toContain(expected) {
      const contains =
        typeof received === "string"
          ? received.includes(String(expected))
          : Array.isArray(received)
            ? received.includes(expected)
            : received instanceof Set
              ? received.has(expected)
              : false;
      verify(
        contains,
        `expected ${formatValue(received)} ${invert ? "not " : ""}to contain ${formatValue(expected)}`,
      );
    },
    toBeGreaterThan(expected) {
      verify(
        Number(received) > Number(expected),
        `expected ${formatValue(received)} ${invert ? "not " : ""}to be greater than ${formatValue(expected)}`,
      );
    },
    toBeGreaterThanOrEqual(expected) {
      verify(
        Number(received) >= Number(expected),
        `expected ${formatValue(received)} ${invert ? "not " : ""}to be greater than or equal to ${formatValue(expected)}`,
      );
    },
    toBeLessThan(expected) {
      verify(
        Number(received) < Number(expected),
        `expected ${formatValue(received)} ${invert ? "not " : ""}to be less than ${formatValue(expected)}`,
      );
    },
    toBeLessThanOrEqual(expected) {
      verify(
        Number(received) <= Number(expected),
        `expected ${formatValue(received)} ${invert ? "not " : ""}to be less than or equal to ${formatValue(expected)}`,
      );
    },
    toBeTruthy() {
      verify(Boolean(received), `expected ${formatValue(received)} ${invert ? "not " : ""}to be truthy`);
    },
    toBeFalsy() {
      verify(!received, `expected ${formatValue(received)} ${invert ? "not " : ""}to be falsy`);
    },
    get not() {
      return createMatchers(received, !invert);
    },
  };
}

if (typeof globalThis.describe !== "function") globalThis.describe = describe;
if (typeof globalThis.it !== "function") globalThis.it = it;
if (typeof globalThis.test !== "function") globalThis.test = test;
if (typeof globalThis.before !== "function") globalThis.before = before;
if (typeof globalThis.after !== "function") globalThis.after = after;
if (typeof globalThis.beforeEach !== "function") globalThis.beforeEach = beforeEach;
if (typeof globalThis.afterEach !== "function") globalThis.afterEach = afterEach;
if (typeof globalThis.expect !== "function") {
  globalThis.expect = function expect(received) {
    return createMatchers(received, false);
  };
}
