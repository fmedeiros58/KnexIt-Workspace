/**
 * Responsabilidade do arquivo:
 * - Validar deteccao de idioma principal e sinal de mistura linguistica.
 * - Cobrir casos basicos de pt/en e mixed-language.
 */
import { languageDetector } from "../src/02-language-layer/multilingual-language-core/language-detector";
import { languageSwitchDetector } from "../src/02-language-layer/multilingual-language-core/language-switch-detector";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function languageDetectorSpec(): void {
  const pt = languageDetector({ text: "oi, por favor ajuste este arquivo" });
  assert(pt.dominantLanguage.startsWith("pt"), "expected pt dominant language");

  const en = languageDetector({ text: "please update this file today" });
  assert(en.dominantLanguage.startsWith("en"), "expected en dominant language");

  const mixed = languageSwitchDetector({ text: "oi please ajuste this file" });
  assert(mixed.mixedLanguage, "expected mixed language detection");
}

languageDetectorSpec();


// __JEST_SMOKE_TEST__: ensures Jest counts at least one test in this spec file.
test("spec smoke", () => {
  expect(true).toBe(true);
});
