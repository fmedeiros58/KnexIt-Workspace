/**
 * Responsabilidade do arquivo:
 * - Validar deteccao de ambiguidade simples em referencias vagas.
 * - Garantir score positivo quando houver pistas de incerteza.
 */
import { ambiguitySignalDetector } from "../src/02-language-layer/semantic-language-core/ambiguity-signal-detector";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function ambiguitySignalDetectorSpec(): void {
  const result = ambiguitySignalDetector({ text: "isso talvez dependa" });
  assert(result.signals.length > 0, "expected ambiguity signals");
  assert(result.score > 0, "expected ambiguity score > 0");
}

ambiguitySignalDetectorSpec();

