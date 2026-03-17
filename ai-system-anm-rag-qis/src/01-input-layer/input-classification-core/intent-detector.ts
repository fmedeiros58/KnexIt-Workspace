export interface IntentDetectorInput {
  text: string;
  language?: string;
}

export interface IntentDetectorOutput {
  intent: string;
  confidence: number;
  signals: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function matchAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function intentDetector(input: IntentDetectorInput): IntentDetectorOutput {
  const text = `${input.text || ""}`.trim();
  const normalized = normalize(text);
  const signals: string[] = [];

  let intent = "chat";
  let confidence = 0.52;

  if (matchAny(normalized, [/\b(resuma|resumir|sumarize|summarize|tl;dr)\b/i])) {
    intent = "summary";
    confidence = 0.86;
    signals.push("summary_keyword");
  } else if (matchAny(normalized, [/\b(escreva|redija|write|draft|compose)\b/i])) {
    intent = "writing";
    confidence = 0.88;
    signals.push("writing_keyword");
  } else if (matchAny(normalized, [/\b(analise|analyze|compare|tradeoff|pros|contras|infer)\b/i])) {
    intent = "analysis";
    confidence = 0.84;
    signals.push("analysis_keyword");
  } else if (
    matchAny(normalized, [/\b(pesquise|pesquisa|buscar|busque|busca|procurar|procure|research|fontes?|sources?|cite|artigo|paper|estudo|literatura|referencias?|scholar|scielo|pubmed)\b/i])
  ) {
    intent = "research";
    confidence = 0.83;
    signals.push("research_keyword");
  } else if (matchAny(normalized, [/\b(ensine|explique|teach|tutorial|step by step|passo a passo)\b/i])) {
    intent = "teaching";
    confidence = 0.8;
    signals.push("teaching_keyword");
  } else if (matchAny(normalized, [/\b(api|typescript|node|python|sql|docker|kubernetes|debug|bug)\b/i])) {
    intent = "technical";
    confidence = 0.79;
    signals.push("technical_keyword");
  } else if (/\?$/.test(normalized) || matchAny(normalized, [/^\s*(quem|qual|como|por que|porque|what|who|why|how|when)\b/i])) {
    intent = "question";
    confidence = 0.74;
    signals.push("question_form");
  }

  if (text.length < 4) {
    confidence = Math.max(0.5, confidence - 0.08);
    signals.push("short_input");
  }

  return {
    intent,
    confidence: Number(Math.min(0.99, Math.max(0.05, confidence)).toFixed(4)),
    signals,
    ok: true,
    component: "intent-detector",
    score: Number(confidence.toFixed(4)),
    detail: intent,
    context: {
      language: input.language || "unknown",
      length: text.length,
      signals,
    },
  };
}
