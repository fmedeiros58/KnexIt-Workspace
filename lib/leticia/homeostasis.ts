let avgActivation = 0.2; // alvo
export function homeostaticAdjust(strengths: number[]): number[] {
  const curr = strengths.reduce((a,b)=>a+b,0)/Math.max(1,strengths.length);
  const ratio = curr>avgActivation ? 0.95 : 1.05;
  return strengths.map(s => Math.max(0, Math.min(1, s*ratio)));
}
