/**
 * Responsabilidade do arquivo:
 * - Condicionar evidencia: limpeza, normalizacao, deduplicacao e marcacao.
 * - Separar sinal util de ruido sem alterar factualidade.
 * - Preservar rastreabilidade de origem para fases epistêmicas posteriores.
 */
import { textNormalizationService } from "../../shared/text-processing/text-normalization.service";
import { normalizeWhitespace, truncateText } from "../../shared/utils/text-utils";
import type { EvidenceItem } from "./iterative-acquisition-types";

function extractDateFromSnippet(text: string): string | null {
  const direct = text.match(/\b(20\d{2}|19\d{2})\b/);
  if (!direct?.[1]) return null;
  return direct[1];
}

function classifySignal(snippet: string): "evidence" | "hint" | "noise" {
  const normalized = normalizeWhitespace(snippet);
  if (!normalized || normalized.length < 20) return "noise";
  if (normalized.length < 70) return "hint";
  return "evidence";
}

export function conditionEvidenceItems(items: EvidenceItem[]): EvidenceItem[] {
  const dedup = new Map<string, EvidenceItem>();

  for (const row of items) {
    const cleanedSnippet = truncateText(normalizeWhitespace(row.snippet), 480);
    const cleanedTitle = truncateText(normalizeWhitespace(row.title || "source"), 180);
    const fingerprint = textNormalizationService.fingerprint(`${cleanedTitle} ${cleanedSnippet}`);
    if (!fingerprint) continue;

    const signal = classifySignal(cleanedSnippet);
    if (signal === "noise") continue;

    const conditioned: EvidenceItem = {
      ...row,
      title: cleanedTitle || "source",
      snippet: cleanedSnippet,
      extractedDate: row.extractedDate ?? extractDateFromSnippet(cleanedSnippet),
      tags: [...new Set([...(row.tags || []), signal])],
    };

    const existing = dedup.get(fingerprint);
    if (!existing || conditioned.retrievalScore > existing.retrievalScore) {
      dedup.set(fingerprint, conditioned);
    }
  }

  return Array.from(dedup.values());
}

