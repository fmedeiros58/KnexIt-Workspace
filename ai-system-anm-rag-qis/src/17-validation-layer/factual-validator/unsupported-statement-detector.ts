export function detectUnsupportedStatements(input: { text: string; sourceCount: number }): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const strongClaims = (input.text.match(/\b(e\s+fato\s+que|comprovadamente|definitivamente)\b/gi) || []).length;
  if (strongClaims > 0 && input.sourceCount < 2) {
    issues.push("strong_claim_low_evidence");
  }
  return { ok: issues.length === 0, issues };
}
