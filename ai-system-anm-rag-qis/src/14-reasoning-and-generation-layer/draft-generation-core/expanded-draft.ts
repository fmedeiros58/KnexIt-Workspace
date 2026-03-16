export function buildExpandedDraft(baseText: string, expansions: string[]): string {
  const block = expansions.filter(Boolean).join("\n");
  return block ? `${baseText}\n\nDetalhamento:\n${block}` : baseText;
}
