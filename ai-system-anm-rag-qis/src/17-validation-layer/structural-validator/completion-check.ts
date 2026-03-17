export function checkCompletion(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) issues.push("empty_completion");
  if (trimmed && !/[.!?)]$/.test(trimmed)) issues.push("possibly_unfinished_completion");
  return { ok: issues.length === 0, issues };
}
