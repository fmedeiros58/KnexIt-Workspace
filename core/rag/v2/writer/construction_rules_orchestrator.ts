export type CitationStyle = "none" | "abnt" | "apa" | "mla" | "chicago";
export type WritingTone = "academic" | "technical" | "neutral";

export type WritingWeights = {
  grounding: number;
  depth: number;
  coherence: number;
  formality: number;
  verbosity: number;
};

export type ConstructionRules = {
  citationStyle: CitationStyle;
  tone: WritingTone;
  targetParagraphsMin: number;
  targetParagraphsMax: number;
  targetSentencesPerParagraphMin: number;
  targetSentencesPerParagraphMax: number;
  weights: WritingWeights;
  commandsDetected: string[];
};

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function parseOptionalPercent(prompt: string, pattern: RegExp) {
  const match = pattern.exec(prompt);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return clamp(Math.round(value), 0, 100);
}

function parseParagraphBounds(prompt: string, defaults: { min: number; max: number }) {
  const explicitRange = /\b(\d{1,2})\s*(?:a|-|ate)\s*(\d{1,2})\s*paragrafos?\b/.exec(prompt);
  if (explicitRange) {
    const min = clamp(Number(explicitRange[1]), 1, 16);
    const max = clamp(Number(explicitRange[2]), min, 20);
    return { min, max };
  }
  const explicitCount = /\b(\d{1,2})\s*paragrafos?\b/.exec(prompt);
  if (explicitCount) {
    const value = clamp(Number(explicitCount[1]), 1, 20);
    return { min: value, max: value };
  }
  return defaults;
}

export function resolveConstructionRules(prompt: string, options: { hasDocumentScope: boolean; deepMode: boolean }): ConstructionRules {
  const normalized = normalize(prompt);
  const commandsDetected: string[] = [];

  let citationStyle: CitationStyle = "none";
  if (/\babnt\b|\bnbr\s*6023\b|\bnorma\s*abnt\b/.test(normalized)) {
    citationStyle = "abnt";
    commandsDetected.push("citation_abnt");
  } else if (/\bapa\b|\bapa\s*7\b|\bapa\s*7th\b/.test(normalized)) {
    citationStyle = "apa";
    commandsDetected.push("citation_apa");
  } else if (/\bmla\b/.test(normalized)) {
    citationStyle = "mla";
    commandsDetected.push("citation_mla");
  } else if (/\bchicago\b/.test(normalized)) {
    citationStyle = "chicago";
    commandsDetected.push("citation_chicago");
  }

  const tone: WritingTone =
    /\bacademic|academico|cientifico|formal\b/.test(normalized)
      ? "academic"
      : /\btecnico|technical|engenharia|juridico|legal\b/.test(normalized)
        ? "technical"
        : "neutral";
  if (tone !== "neutral") commandsDetected.push(`tone_${tone}`);

  const defaults = options.deepMode || options.hasDocumentScope ? { min: 6, max: 10 } : { min: 4, max: 7 };
  const paragraphBounds = parseParagraphBounds(normalized, defaults);
  if (paragraphBounds.min !== defaults.min || paragraphBounds.max !== defaults.max) {
    commandsDetected.push("paragraph_override");
  }

  const sentencesMin = options.deepMode || options.hasDocumentScope ? 4 : 3;
  const sentencesMax = options.deepMode || options.hasDocumentScope ? 7 : 6;

  const grounding = parseOptionalPercent(normalized, /\b(?:peso\s+)?(?:grounding|ancoragem|fidelidade)\s*[:=]?\s*(\d{1,3})\b/) ?? 88;
  const depth = parseOptionalPercent(normalized, /\b(?:peso\s+)?(?:depth|profundidade)\s*[:=]?\s*(\d{1,3})\b/) ?? (options.deepMode ? 84 : 72);
  const coherence = parseOptionalPercent(normalized, /\b(?:peso\s+)?(?:coherence|coesao|coerencia)\s*[:=]?\s*(\d{1,3})\b/) ?? 86;
  const formality = parseOptionalPercent(normalized, /\b(?:peso\s+)?(?:formality|formalidade)\s*[:=]?\s*(\d{1,3})\b/) ?? 78;
  const verbosity = parseOptionalPercent(normalized, /\b(?:peso\s+)?(?:verbosity|extensao|detalhamento)\s*[:=]?\s*(\d{1,3})\b/) ?? 80;
  if (/(?:peso|grounding|ancoragem|profundidade|coerencia|formalidade|detalhamento)/.test(normalized)) {
    commandsDetected.push("weights_custom");
  }

  return {
    citationStyle,
    tone,
    targetParagraphsMin: paragraphBounds.min,
    targetParagraphsMax: paragraphBounds.max,
    targetSentencesPerParagraphMin: sentencesMin,
    targetSentencesPerParagraphMax: sentencesMax,
    weights: {
      grounding,
      depth,
      coherence,
      formality,
      verbosity,
    },
    commandsDetected,
  };
}

export function buildConstructionRulesDirective(rules: ConstructionRules) {
  const directives: string[] = [
    `Mantenha tom ${rules.tone === "academic" ? "academico formal" : rules.tone === "technical" ? "tecnico objetivo" : "neutro claro"}.`,
    `Meta de estrutura: ${rules.targetParagraphsMin} a ${rules.targetParagraphsMax} paragrafos.`,
    `Meta por paragrafo: ${rules.targetSentencesPerParagraphMin} a ${rules.targetSentencesPerParagraphMax} frases.`,
    `Pesos de construcao -> ancoragem:${rules.weights.grounding} profundidade:${rules.weights.depth} coerencia:${rules.weights.coherence} formalidade:${rules.weights.formality} detalhamento:${rules.weights.verbosity}.`,
  ];

  if (rules.citationStyle === "abnt") {
    directives.push("Se houver citacao textual, siga formato ABNT (AUTOR, ano, p. x) sem inventar referencias.");
  } else if (rules.citationStyle === "apa") {
    directives.push("Se houver citacao textual, siga formato APA (Author, year, p. x) sem inventar referencias.");
  } else if (rules.citationStyle === "mla") {
    directives.push("Se houver citacao textual, siga formato MLA (Author page) sem inventar referencias.");
  } else if (rules.citationStyle === "chicago") {
    directives.push("Se houver citacao textual, siga formato Chicago (Author Year, page) sem inventar referencias.");
  }

  return directives.join(" ");
}

