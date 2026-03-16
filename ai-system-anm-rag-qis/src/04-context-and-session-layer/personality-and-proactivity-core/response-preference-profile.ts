import { analyzeText, clamp01, countMatches } from "./personality-utils";

export interface ResponsePreferenceProfileInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ResponsePreferenceProfileOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function pickFormatPreference(normalized: string) {
  if (/\b(passo a passo|step by step)\b/g.test(normalized)) return "stepwise";
  if (/\b(lista|bullet|topico|itens)\b/g.test(normalized)) return "list";
  if (/\b(tabela|table|quadro)\b/g.test(normalized)) return "table";
  if (/\b(codigo|code|snippet)\b/g.test(normalized)) return "code";
  if (/\b(resumo|summary)\b/g.test(normalized)) return "summary";
  return "paragraph";
}

function pickLengthPreference(normalized: string) {
  if (/\b(curto|breve|resumido|short)\b/g.test(normalized)) return "short";
  if (/\b(detalhado|completo|profundo|long|deep)\b/g.test(normalized)) return "long";
  return "medium";
}

export function responsePreferenceProfile(
  input: ResponsePreferenceProfileInput = {},
): ResponsePreferenceProfileOutput {
  const analysis = analyzeText(input.text);
  const formatPreference = pickFormatPreference(analysis.normalized);
  const lengthPreference = pickLengthPreference(analysis.normalized);
  const citationRequestHits = countMatches(
    analysis.normalized,
    /\b(cite|citacao|fonte|source|referencia|reference)\b/g,
  );
  const exampleRequestHits = countMatches(
    analysis.normalized,
    /\b(exemplo|example|sample|demo)\b/g,
  );

  const inferredScore = clamp01(
    0.34 +
    (formatPreference !== "paragraph" ? 0.2 : 0.08) +
    (lengthPreference !== "medium" ? 0.16 : 0.08) +
    (Math.min(1, citationRequestHits / 3) * 0.16) +
    (Math.min(1, exampleRequestHits / 3) * 0.14),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "response-preference-profile",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `format=${formatPreference}; length=${lengthPreference}; citationHits=${citationRequestHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      formatPreference,
      lengthPreference,
      citationRequestHits,
      exampleRequestHits,
      hasText: Boolean(analysis.text),
    },
  };
}
