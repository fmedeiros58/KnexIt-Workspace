export function checkTruncation(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (/\.\.\.$/.test(text.trim())) issues.push("possible_truncation");
  return { ok: issues.length === 0, issues };
}
