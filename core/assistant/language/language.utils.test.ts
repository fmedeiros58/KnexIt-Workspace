import { detectLanguage, dominantLanguageFromTexts } from "@/core/assistant/language/language.utils";

describe("language.utils", () => {
  it("detecta portugues para texto suficiente em pt-BR", () => {
    const sample =
      "Preciso de uma analise detalhada deste documento, com contexto, argumentos e conclusao em linguagem academica.";
    const detected = detectLanguage(sample);
    expect(detected.tag.toLowerCase().startsWith("pt")).toBe(true);
    expect(detected.confidence).toBeGreaterThan(0);
  });

  it("detecta ingles para texto suficiente em en", () => {
    const sample =
      "Please provide a detailed critical review of this document, covering method, evidence, implications and limitations.";
    const detected = detectLanguage(sample);
    expect(detected.tag.toLowerCase().startsWith("en")).toBe(true);
    expect(detected.confidence).toBeGreaterThan(0);
  });

  it("retorna fallback pt-BR quando entrada e indefinida/curta", () => {
    const detected = dominantLanguageFromTexts(["oi", "ok"]);
    expect(detected.tag).toBe("pt-BR");
    expect(detected.confidence).toBeGreaterThanOrEqual(0.4);
  });
});

