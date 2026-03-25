export function runClaimCheck(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) issues.push("empty_claim_set");
  if (/\b(garantido|certeza absoluta|sem duvida|100%)\b/i.test(trimmed)) {
    issues.push("absolute_claim_language");
  }
  return { ok: issues.length === 0, issues };
}
