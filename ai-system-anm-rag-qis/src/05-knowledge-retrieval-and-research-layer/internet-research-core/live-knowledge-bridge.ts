export function buildLiveKnowledgeHints(input: {
  usedWeb: boolean;
  verified: boolean;
  issueCount: number;
}): string[] {
  if (!input.usedWeb) return [];
  const hints = ["Pesquisa web acionada para ampliar cobertura de evidencia."];
  if (!input.verified) hints.push("Resultado web requer verificacao adicional antes de afirmacoes fortes.");
  if (input.issueCount > 0) hints.push("Foram detectados sinais de risco nas fontes externas.");
  return hints;
}
