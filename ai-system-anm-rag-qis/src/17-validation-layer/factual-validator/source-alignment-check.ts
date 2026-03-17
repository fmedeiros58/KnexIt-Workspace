export function runSourceAlignmentCheck(input: { text: string; sourceCount: number }): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (input.sourceCount <= 0) issues.push("no_supporting_sources");
  if (/fonte/i.test(input.text) && input.sourceCount <= 0) issues.push("source_mention_without_source");
  return { ok: issues.length === 0, issues };
}
