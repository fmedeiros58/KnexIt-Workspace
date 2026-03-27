/** ai-system-anm */
function normalize(value: string) {
  return `${value || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

export function cleanRedundancy(text: string): string {
  const paragraphs = `${text || ""}`
    .split(/\n{2,}/g)
    .map((row) => row.trim())
    .filter(Boolean);

  const deduped: string[] = [];
  for (const paragraph of paragraphs) {
    const normalized = normalize(paragraph);
    if (deduped.some((row) => normalize(row) === normalized)) continue;
    deduped.push(paragraph);
  }

  return deduped.join("\n\n").trim();
}
