export function shouldUseWebResearch(input: {
  query: string;
  localSourceCount: number;
  verifiable: boolean;
}): boolean {
  if (input.verifiable) return true;
  if (input.localSourceCount === 0) return true;
  return /\b(atual|hoje|ultimo|latest|today|current)\b/i.test(input.query);
}
