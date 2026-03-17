export function checkEmptySections(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/^\s*Resposta:\s*$/m.test(text)) issues.push("empty_heading_section");
  return { ok: issues.length === 0, issues };
}
