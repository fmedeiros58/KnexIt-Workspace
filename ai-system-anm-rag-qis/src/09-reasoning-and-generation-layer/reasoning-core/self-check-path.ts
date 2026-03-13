export function runSelfCheckPath(input: { text: string; caveats: string[] }): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  if (!input.text.trim()) notes.push("empty_draft");
  if (input.caveats.length > 0 && !/caveat|incerteza|limite/i.test(input.text)) {
    notes.push("missing_caveat_language");
  }
  return { ok: notes.length === 0, notes };
}
