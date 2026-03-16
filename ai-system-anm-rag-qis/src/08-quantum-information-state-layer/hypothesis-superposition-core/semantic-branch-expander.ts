export interface SemanticBranchExpanderInput {
  interpretations: string[];
  evidenceHints: string[];
}

export interface SemanticBranchExpanderOutput {
  branches: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function compact(value: string, maxChars = 100) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

export function semanticBranchExpander(input: SemanticBranchExpanderInput): SemanticBranchExpanderOutput {
  const hints = input.evidenceHints.slice(0, 2).map((item) => compact(item));
  const branches = input.interpretations
    .slice(0, 4)
    .map((interpretation, index) => {
      const hint = hints[index % Math.max(1, hints.length)] || "sem evidencia dominante";
      return `${interpretation} | evidencia-guia: ${hint}`;
    });

  return {
    branches,
    ok: true,
    component: "semantic-branch-expander",
    score: Number(Math.min(0.92, 0.42 + (branches.length * 0.12)).toFixed(4)),
    detail: `branches=${branches.length}`,
    context: {
      hintCount: hints.length,
    },
  };
}
