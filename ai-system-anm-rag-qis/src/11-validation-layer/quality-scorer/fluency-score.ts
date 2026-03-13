export function scoreFluency(text: string): number {
  if (!text.trim()) return 0;
  const punctuationRatio = (text.match(/[.,;:!?]/g) || []).length / Math.max(1, text.length);
  const lineBreakRatio = (text.match(/\n/g) || []).length / Math.max(1, text.length);
  const score = 0.74 + Math.min(0.14, punctuationRatio * 35) + Math.min(0.1, lineBreakRatio * 45);
  return Number(Math.min(1, Math.max(0, score)).toFixed(4));
}
