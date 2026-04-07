import type { CandidateAction, FeasibleAction, LogicalFrame, RejectedAction } from "./logical-discernment-types";
import { normalizeLogicalText } from "./logical-discernment-utils";

function violatesConstraint(actionLabel: string, constraints: string[]): string | null {
  const normalizedAction = normalizeLogicalText(actionLabel);
  if (!normalizedAction) return "acao_sem_label";

  if (constraints.includes("restricao_tempo") && /\b(multiplas idas|varias etapas sem ordem)\b/.test(normalizedAction)) {
    return "viola_restricao_tempo";
  }
  if (
    constraints.includes("restricao_orcamentaria") &&
    /\b(alto custo|custo elevado|deslocamento duplicado|multiplas idas)\b/.test(normalizedAction)
  ) {
    return "viola_restricao_orcamentaria";
  }
  if (
    constraints.includes("restricao_seguranca") &&
    /\b(andar sozinho a noite|rota escura|risco elevado)\b/.test(normalizedAction)
  ) {
    return "viola_restricao_seguranca";
  }
  return null;
}

function inferPrimaryGoalAlignment(label: string, primaryGoal: string | null): boolean {
  if (!primaryGoal) return true;
  const actionNorm = normalizeLogicalText(label);
  const goalNorm = normalizeLogicalText(primaryGoal);
  if (!actionNorm || !goalNorm) return true;

  const goalTokens = new Set(goalNorm.split(" ").filter((token) => token.length > 3));
  if (!goalTokens.size) return true;
  const actionTokens = new Set(actionNorm.split(" ").filter((token) => token.length > 3));
  let overlap = 0;
  goalTokens.forEach((token) => {
    if (actionTokens.has(token)) overlap += 1;
  });
  return overlap >= 1 || /otimizar|reduzir|minimizar|acoplar/.test(actionNorm);
}

export function evaluateFeasibility(params: {
  candidates: CandidateAction[];
  frameSeed: Pick<LogicalFrame, "constraints" | "primaryGoal">;
}): {
  feasibleActions: FeasibleAction[];
  rejectedActions: RejectedAction[];
} {
  const feasibleActions: FeasibleAction[] = [];
  const rejectedActions: RejectedAction[] = [];

  for (const action of params.candidates) {
    const violation = violatesConstraint(action.label, params.frameSeed.constraints);
    const aligns = inferPrimaryGoalAlignment(action.label, params.frameSeed.primaryGoal);
    if (violation) {
      rejectedActions.push({
        label: action.label,
        reason: violation,
      });
      continue;
    }

    feasibleActions.push({
      id: action.id,
      label: action.label,
      rationale: action.rationale,
      risks: action.risks,
      satisfiesPrimaryGoal: aligns,
      satisfiesConstraints: true,
    });
  }

  return { feasibleActions, rejectedActions };
}

