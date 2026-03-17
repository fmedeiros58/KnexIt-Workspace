/**
 * Responsabilidade do arquivo:
 * - Deduplicar candidatos de fonte por URL/titulo/snippet normalizados.
 * - Reduzir redundancia antes de alinhamento e merge de evidencias.
 * - Preservar ordem de chegada para estabilidade do pipeline.
 */
interface DedupCandidate {
  title?: string;
  url?: string;
  snippet?: string;
}

function normalizeKeyPart(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeKnowledgeCandidates<T extends DedupCandidate>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = [
      normalizeKeyPart(item.url),
      normalizeKeyPart(item.title),
      normalizeKeyPart(item.snippet).slice(0, 120),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}
