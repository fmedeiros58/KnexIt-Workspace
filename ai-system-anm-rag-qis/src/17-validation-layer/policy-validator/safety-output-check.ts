export function runSafetyOutputCheck(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/\b(elimine|ataque|violencia\s+direta)\b/i.test(text)) issues.push("violent_directive_language");
  return { ok: issues.length === 0, issues };
}
