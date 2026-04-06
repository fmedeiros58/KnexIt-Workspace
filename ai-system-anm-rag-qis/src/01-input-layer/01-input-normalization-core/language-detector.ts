export interface LanguageDetectorInput {
  text: string;
}

export interface LanguageDetectorOutput {
  language: "pt-BR" | "en-US" | "es-ES" | "unknown";
  confidence: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function languageDetector(input: LanguageDetectorInput): LanguageDetectorOutput {
  const normalized = (input.text || "").toLowerCase();
  if (!normalized.trim()) {
    return {
      language: "unknown",
      confidence: 0.1,
      ok: true,
      component: "language-detector",
      score: 0.1,
      detail: "unknown",
      context: {},
    };
  }

  if (/\b(nao|não|voce|você|para|com|qual|como|porque|resuma|escreva)\b/.test(normalized) || /[ãõçáéíóú]/.test(normalized)) {
    return {
      language: "pt-BR",
      confidence: 0.88,
      ok: true,
      component: "language-detector",
      score: 0.88,
      detail: "pt-BR",
      context: {},
    };
  }

  if (/\b(what|who|when|how|why|please|write|summarize|compare)\b/.test(normalized)) {
    return {
      language: "en-US",
      confidence: 0.84,
      ok: true,
      component: "language-detector",
      score: 0.84,
      detail: "en-US",
      context: {},
    };
  }

  if (/\b(que|cuando|como|por qué|porque|resumir|escribe)\b/.test(normalized)) {
    return {
      language: "es-ES",
      confidence: 0.82,
      ok: true,
      component: "language-detector",
      score: 0.82,
      detail: "es-ES",
      context: {},
    };
  }

  return {
    language: "unknown",
    confidence: 0.4,
    ok: true,
    component: "language-detector",
    score: 0.4,
    detail: "unknown",
    context: {},
  };
}
