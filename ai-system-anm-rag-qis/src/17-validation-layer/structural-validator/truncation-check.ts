export function checkTruncation(text: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return { ok: false, issues: ["empty_text"] };

  if (/\.\.\.$/.test(trimmed)) issues.push("possible_truncation");
  if (trimmed.includes("\u00ef\u00bf\u00bd") || trimmed.includes("\uFFFD")) {
    issues.push("replacement_char_detected");
  }
  if (/[,:;\-]$/.test(trimmed)) issues.push("open_ending_punctuation");
  if (!/[.!?)]$/.test(trimmed)) issues.push("missing_terminal_punctuation");
  if (/\b(e|ou|mas|porque|portanto|logo|assim|entao|and|or|but|because|therefore)\s*[:\-]?\s*$/i.test(trimmed)) {
    issues.push("dangling_connector_ending");
  }
  if (/\b(modelo|alternativa|item|secao|se(?:\u00e7\u00e3o|cao))\s*\d*\s*[:\-]\s*$/i.test(trimmed)) {
    issues.push("incomplete_section_ending");
  }

  return { ok: issues.length === 0, issues };
}
