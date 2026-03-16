export function runRestrictedContentFilter(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/\b(como\s+fraudar|como\s+hackear|invadir\s+sistema)\b/i.test(text)) {
    issues.push("restricted_harmful_instruction");
  }
  return { ok: issues.length === 0, issues };
}
