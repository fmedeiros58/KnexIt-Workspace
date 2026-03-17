export function buildCriticalObservations(input: {
  assumptions: string[];
  contradictions: string[];
  limitations: string[];
  tradeoffs: string[];
}): string[] {
  return [
    ...input.assumptions,
    ...input.contradictions,
    ...input.limitations,
    ...input.tradeoffs,
  ].slice(0, 8);
}
