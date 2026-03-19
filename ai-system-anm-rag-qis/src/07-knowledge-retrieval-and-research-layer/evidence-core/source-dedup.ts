/**
 * Responsabilidade do arquivo:
 * - Deduplicar candidatos de fonte por URL/titulo/snippet normalizados.
 * - Reduzir redundancia antes de alinhamento e merge de evidencias.
 * - Preservar ordem de chegada para estabilidade do pipeline.
 */
import { textNormalizationService } from "../../shared/text-processing/text-normalization.service";

interface DedupCandidate {
  title?: string;
  url?: string;
  snippet?: string;
}

function normalizeUrlPart(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextKeyPart(value: string | undefined) {
  return textNormalizationService.fingerprint(value || "");
}

export function dedupeKnowledgeCandidates<T extends DedupCandidate>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const key = [
      normalizeUrlPart(item.url),
      normalizeTextKeyPart(item.title),
      normalizeTextKeyPart(item.snippet).slice(0, 120),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}
