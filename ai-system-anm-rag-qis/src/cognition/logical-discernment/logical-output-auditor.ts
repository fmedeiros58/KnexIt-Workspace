import type { LogicalAudit, LogicalFrame } from "./logical-discernment-types";
import { clamp01, normalizeLogicalText } from "./logical-discernment-utils";

function hasTokenOverlap(text: string, probe: string): boolean {
  const normalizedText = normalizeLogicalText(text);
  const normalizedProbe = normalizeLogicalText(probe);
  if (!normalizedText || !normalizedProbe) return false;

  const probeTokens = new Set(normalizedProbe.split(" ").filter((token) => token.length > 3));
  if (!probeTokens.size) return false;
  let hits = 0;
  probeTokens.forEach((token) => {
    if (normalizedText.includes(token)) hits += 1;
  });
  return hits >= Math.min(2, probeTokens.size);
}

function requiresMarginalCostSignal(frame: LogicalFrame): boolean {
  return frame.dominantPrinciple === "economy" || frame.relevantCosts.includes("custo_marginal");
}

function buildRepairBlock(frame: LogicalFrame): string {
  const lines = [
    "Sintese logico-pratica:",
    `- Objetivo principal: ${frame.primaryGoal || "nao explicitado com precisao"}.`,
    `- Principio dominante: ${frame.dominantPrinciple}.`,
  ];
  if (frame.constraints.length > 0) {
    lines.push(`- Restricoes consideradas: ${frame.constraints.slice(0, 4).join(", ")}.`);
  }
  if (frame.recommendedAction) {
    lines.push(`- Melhor acao factivel: ${frame.recommendedAction}.`);
    lines.push(`- Justificativa: ${frame.recommendationReason || "melhor relacao entre objetivo, restricoes e custo marginal"}.`);
  } else {
    lines.push("- Melhor acao factivel: nao definida com os dados atuais.");
  }
  if (frame.dominantPrinciple === "economy") {
    lines.push("- Observacao de custo marginal: priorize reduzir deslocamento extra e custo adicional evitavel.");
  }
  return lines.join("\n");
}

export function runLogicalOutputAuditor(params: {
  frame: LogicalFrame | null;
  responseText: string;
}): LogicalAudit {
  const frame = params.frame;
  const source = `${params.responseText || ""}`.trim();

  if (!frame || !frame.shouldTriggerOutputAudit) {
    return {
      passed: true,
      issues: [],
      score: 0.92,
    };
  }

  const issues: string[] = [];
  if (!source) {
    issues.push("empty_response");
  }

  if (frame.primaryGoal && !hasTokenOverlap(source, frame.primaryGoal)) {
    issues.push("primary_goal_not_visible");
  }

  if (frame.recommendedAction && !hasTokenOverlap(source, frame.recommendedAction)) {
    issues.push("recommended_action_not_visible");
  }

  if (
    frame.constraints.length > 0 &&
    !frame.constraints.some((constraint) => hasTokenOverlap(source, constraint))
  ) {
    issues.push("constraints_not_visible");
  }

  if (requiresMarginalCostSignal(frame)) {
    const normalized = normalizeLogicalText(source);
    const hasMarginalLanguage =
      /\b(custo marginal|custo adicional|deslocamento extra|custo evitavel)\b/.test(normalized);
    if (!hasMarginalLanguage) {
      issues.push("marginal_cost_ignored");
    }
  }

  if (frame.dominantPrinciple === "safety") {
    const normalized = normalizeLogicalText(source);
    if (!/\b(seguranca|risco|exposicao)\b/.test(normalized)) {
      issues.push("safety_priority_not_enforced");
    }
  }

  const score = clamp01(1 - (issues.length * 0.16));
  if (issues.length === 0) {
    return {
      passed: true,
      issues: [],
      score,
    };
  }

  const repair = buildRepairBlock(frame);
  const repairedResponse = source
    ? `${source}\n\n${repair}`.trim()
    : repair;

  return {
    passed: false,
    issues,
    repairedResponse,
    score,
  };
}
