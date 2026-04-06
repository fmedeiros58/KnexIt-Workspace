/**
 * Responsabilidade do arquivo:
 * - Garantir reparo de mojibake basico na entrada.
 * - Evitar regressao em cenarios comuns de acentuacao quebrada.
 */
import { encodingNormalizer } from "../src/01-input-layer/01-input-normalization-core/encoding-normalizer";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const repaired = encodingNormalizer({ text: "Voc\u00C3\u00AA est\u00C3\u00A1 bem?" });
assert(repaired.hadEncodingNoise, "expected encoding noise to be detected");
assert(repaired.text === "Voc\u00EA est\u00E1 bem?", "expected mojibake text to be repaired");

const untouched = encodingNormalizer({ text: "Voce esta bem?" });
assert(!untouched.hadEncodingNoise, "expected plain ASCII text to remain untouched");
assert(untouched.text === "Voce esta bem?", "expected untouched text to remain identical");
