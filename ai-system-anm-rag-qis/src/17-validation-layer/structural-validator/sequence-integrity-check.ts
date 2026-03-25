export function checkSequenceIntegrity(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const hasConclusionBeforeBody = /conclusao:/i.test(text) && /resposta:/i.test(text) && text.search(/conclusao:/i) < text.search(/resposta:/i);
  if (hasConclusionBeforeBody) issues.push("out_of_order_sections");
  return { ok: issues.length === 0, issues };
}
