export function scoreCoherence(input: { assumptions: number; tensions: number; paragraphCount: number }): number {
  const base = 0.82;
  const penalty = input.tensions * 0.05 + Math.max(0, input.assumptions - 2) * 0.03;
  const bonus = Math.min(0.08, input.paragraphCount * 0.015);
  return Number(Math.min(1, Math.max(0, base - penalty + bonus)).toFixed(4));
}
