export function runPrivacyGuard(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/.test(text)) issues.push("possible_sensitive_identifier");
  if (/\b(senha|password|token secreto)\b/i.test(text)) issues.push("sensitive_secret_mention");
  return { ok: issues.length === 0, issues };
}
