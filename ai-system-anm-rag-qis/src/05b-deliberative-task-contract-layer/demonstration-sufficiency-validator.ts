export interface DemonstrationSufficiencyResult {
  score: number;
  passed: boolean;
  issues: string[];
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((acc, pattern) => acc + (pattern.test(text) ? 1 : 0), 0);
}

export function validateDemonstrationSufficiency(responseText: string): DemonstrationSufficiencyResult {
  const normalized = normalize(responseText);
  if (!normalized) {
    return {
      score: 0,
      passed: false,
      issues: ["empty_response_for_demonstration"],
    };
  }

  const definitionHits = countMatches(normalized, [
    /\b(defin|seja|considere|termo|escopo|conjunto|dominio|predicado|predicados|variaveis?|criterios?)\b/,
    /\b(p1|p2|p3|axioma|d\(s\)|d\(d\)|estado decisorio)\b/,
  ]);
  const hypothesisHits = countMatches(normalized, [
    /\b(hipotese|assuma|suponha|dado que|se|sob a condicao|assumindo)\b/,
    /\b(estado|cenario|s\(|s=|estado decisorio|estado factivel|condicao suficiente)\b/,
  ]);
  const inferenceHits = countMatches(normalized, [
    /\b(logo|portanto|implica|entao|segue que|deriva|decorre|disso resulta|dessa condicao segue)\b/,
    /\b(se .* entao|nao existe|impossibilidade|incompativel|insatisfazibilidade|toda alternativa viola)\b/,
  ]);
  const conclusionHits = countMatches(normalized, [
    /\b(conclusao|assim|em sintese|portanto)\b/,
    /\b(nao pode|nao existe decisao|impossivel satisfazer)\b/,
  ]);

  const hasStepStructure =
    /(\(a\)|1\.|2\.)/.test(normalized) || /\n-\s+/.test(responseText) || /\n\d+\.\s+/.test(responseText);

  const scoreRaw =
    (Math.min(2, definitionHits) * 0.2) +
    (Math.min(2, hypothesisHits) * 0.2) +
    (Math.min(2, inferenceHits) * 0.3) +
    (Math.min(2, conclusionHits) * 0.2) +
    (hasStepStructure ? 0.1 : 0);
  const score = Math.max(0, Math.min(1, scoreRaw));

  const issues: string[] = [];
  if (definitionHits === 0) issues.push("missing_operational_definitions");
  if (hypothesisHits === 0) issues.push("missing_explicit_hypothesis_or_state_construction");
  if (inferenceHits === 0) issues.push("missing_inference_chain");
  if (conclusionHits === 0) issues.push("missing_derived_conclusion");

  return {
    score: Number(score.toFixed(4)),
    passed: score >= 0.62 && issues.length <= 1,
    issues,
  };
}
