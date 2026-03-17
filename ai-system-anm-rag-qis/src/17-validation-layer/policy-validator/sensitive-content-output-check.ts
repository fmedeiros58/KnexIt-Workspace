export function runSensitiveContentOutputCheck(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/\b(dados\s+bancarios|cartao\s+de\s+credito|cvv)\b/i.test(text)) issues.push("sensitive_financial_data");
  return { ok: issues.length === 0, issues };
}
