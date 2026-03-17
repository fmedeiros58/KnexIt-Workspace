/**
 * Responsabilidade do arquivo:
 * - Validar reparo de mojibake na camada de apresentacao.
 * - Garantir sinalizacao de quando UTF-8 foi normalizado.
 */
import { ensureUtf8Response } from "../src/18-presentation-and-delivery-layer/text-encoding-guard";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fixed = ensureUtf8Response("Voc\u00C3\u00AA est\u00C3\u00A1 bem?");
assert(fixed.repaired, "expected UTF-8 guard to mark repaired text");
assert(fixed.text.includes("\u00EA"), "expected repaired text with proper accent");

const untouched = ensureUtf8Response("Voce esta bem?");
assert(!untouched.repaired, "expected untouched ASCII text");

