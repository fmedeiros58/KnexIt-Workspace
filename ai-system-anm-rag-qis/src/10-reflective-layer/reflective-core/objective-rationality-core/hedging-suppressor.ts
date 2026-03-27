const HEDGING_PATTERNS: RegExp[] = [
  /\bdepende\b/gi,
  /\be importante considerar\b/gi,
  /\bpor outro lado\b/gi,
  /\bpode variar\b/gi,
  /\bvaria de acordo\b/gi,
  /\bem resumo a melhor opcao depende\b/gi,
  /\ba melhor opcao depende\b/gi,
  /\bse a prioridade for\b/gi,
  /\bpor outro lado se\b/gi,
];

export function suppressUndueHedging(text: string): string {
  let updated = `${text || ""}`;

  for (const pattern of HEDGING_PATTERNS) {
    updated = updated.replace(pattern, "");
  }

  updated = updated
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();

  return updated;
}

export function containsStrongHedging(text: string): boolean {
  const normalized = `${text || ""}`.toLowerCase();
  return (
    normalized.includes("depende") ||
    normalized.includes("por outro lado") ||
    normalized.includes("e importante considerar") ||
    normalized.includes("varia de acordo")
  );
}

