export function checkBrokenParagraphs(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/\n[^\n]{0,12}\n/.test(text)) issues.push("very_short_or_broken_paragraph");
  return { ok: issues.length === 0, issues };
}
