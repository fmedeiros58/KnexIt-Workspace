import { analyzeText, clamp01, countMatches } from "./personality-utils";

export interface PersonalConstraintRegistryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface PersonalConstraintRegistryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function collectConstraints(normalized: string) {
  const constraints: string[] = [];
  if (/\b(sem web|sem internet|offline|nao use internet|no web)\b/g.test(normalized)) {
    constraints.push("no_external_web");
  }
  if (/\b(curto|breve|objetivo|resuma|conciso|short)\b/g.test(normalized)) {
    constraints.push("prefer_short_response");
  }
  if (/\b(detalhado|profundo|aprofunde|completo|detailed|deep)\b/g.test(normalized)) {
    constraints.push("prefer_detailed_response");
  }
  if (/\b(passo a passo|step by step)\b/g.test(normalized)) {
    constraints.push("prefer_stepwise_structure");
  }
  if (/\b(codigo|code|snippet)\b/g.test(normalized)) {
    constraints.push("prefer_code_examples");
  }
  if (/\b(pt-br|portugues|em portugues)\b/g.test(normalized)) {
    constraints.push("language_pt_br");
  }
  if (/\b(en-us|english|em ingles)\b/g.test(normalized)) {
    constraints.push("language_en_us");
  }
  if (/\b(sem floreio|sem filler|direto ao ponto)\b/g.test(normalized)) {
    constraints.push("no_fluff");
  }
  return constraints;
}

export function personalConstraintRegistry(
  input: PersonalConstraintRegistryInput = {},
): PersonalConstraintRegistryOutput {
  const analysis = analyzeText(input.text);
  const constraints = collectConstraints(analysis.normalized);
  const negationHits = countMatches(analysis.normalized, /\b(nao|sem|nunca|evite|without|do not)\b/g);

  const inferredScore = clamp01(
    0.28 +
    (Math.min(1, constraints.length / 4) * 0.5) +
    (Math.min(1, negationHits / 5) * 0.22),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "personal-constraint-registry",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `constraints=${constraints.length}; negationHits=${negationHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      constraints,
      negationHits,
      hasHardConstraint: constraints.length > 0 && negationHits > 0,
      hasText: Boolean(analysis.text),
    },
  };
}
