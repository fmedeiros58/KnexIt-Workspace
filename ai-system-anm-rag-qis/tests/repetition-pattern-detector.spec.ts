/**
 * Responsabilidade do arquivo:
 * - Validar deteccao de repeticao discursiva em sentencas quase identicas.
 * - Cobrir caso solicitado de repeticao imediata.
 */
import { repetitionPatternDetector } from "../src/02-language-layer/discourse-form-core/repetition-pattern-detector";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function repetitionPatternDetectorSpec(): void {
  const result = repetitionPatternDetector({ text: "tudo bem? tudo bem?" });
  assert(result.repetitionDetected, "expected repetition detection");
}

repetitionPatternDetectorSpec();


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
