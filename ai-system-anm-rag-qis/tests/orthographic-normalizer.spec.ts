/**
 * Responsabilidade do arquivo:
 * - Validar normalizacao ortografica leve e reparo de typo evidente.
 * - Garantir que texto estabilizado nao fique vazio.
 */
import { normalizationPriorityEngine } from "../src/02-language-layer/linguistic-normalization-core/normalization-priority-engine";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function orthographicNormalizerSpec(): void {
  const result = normalizationPriorityEngine({ text: "  ajsute    esse  arquivo!!!  " });
  assert(result.stabilizedText.length > 0, "expected non-empty stabilized text");
  assert(/ajuste/i.test(result.stabilizedText), "expected typo repair to suggest 'ajuste'");
}

orthographicNormalizerSpec();


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
