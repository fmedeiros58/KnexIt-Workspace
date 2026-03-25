export function scoreRelevance(input: { message: string; answer: string }): number {
  const questionTerms = new Set(input.message.toLowerCase().split(/\W+/g).filter((item) => item.length > 3));
  const answerTerms = new Set(input.answer.toLowerCase().split(/\W+/g).filter((item) => item.length > 3));
  if (!questionTerms.size || !answerTerms.size) return 0.45;
  let overlap = 0;
  for (const term of questionTerms) {
    if (answerTerms.has(term)) overlap += 1;
  }
  return Number(Math.min(1, Math.max(0, overlap / questionTerms.size)).toFixed(4));
}
