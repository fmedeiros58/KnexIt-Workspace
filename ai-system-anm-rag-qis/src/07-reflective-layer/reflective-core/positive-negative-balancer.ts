export function balancePositiveNegative(observations: string[]): { strengths: string[]; risks: string[] } {
  const strengths: string[] = [];
  const risks: string[] = [];
  for (const item of observations) {
    if (/reduz|robust|consistente|forte/i.test(item)) strengths.push(item);
    else risks.push(item);
  }
  return {
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 5),
  };
}
