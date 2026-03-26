/**
 * Responsabilidade do arquivo:
 * - Preparar candidatos de conflito sem decidir veredito final.
 * - Agrupar evidencias potencialmente divergentes para camada epistêmica/validacao.
 * - Sinalizar sensibilidade de conflito para adjudicacao posterior.
 */
import { detectEvidenceContradictions } from "../evidence-core/contradiction-detector";
import type { EvidenceConflictCandidate, EvidenceItem } from "./iterative-acquisition-types";

function detectNumericConflicts(items: EvidenceItem[]): EvidenceConflictCandidate[] {
  const conflicts: EvidenceConflictCandidate[] = [];
  const byTitle = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const key = `${item.title || ""}`.toLowerCase().trim();
    if (!key) continue;
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(item);
  }

  for (const [title, rows] of byTitle.entries()) {
    if (rows.length < 2) continue;
    const values = rows
      .flatMap((row) => Array.from((row.snippet || "").matchAll(/\b\d+(?:[.,]\d+)?\b/g)).map((match) => match[0]));
    const uniqueValues = [...new Set(values)];
    if (uniqueValues.length < 2) continue;
    conflicts.push({
      conflictId: `numeric:${Math.abs(hashCode(title))}`,
      conflictType: "numeric_conflict",
      evidenceIds: rows.map((row) => row.id),
      sensitivity: Math.min(1, 0.4 + (uniqueValues.length * 0.1)),
      notes: [`Valores distintos detectados para: ${title}`],
    });
  }
  return conflicts;
}

export function prepareEvidenceConflicts(items: EvidenceItem[]): EvidenceConflictCandidate[] {
  const contradictions = detectEvidenceContradictions(
    items.map((row) => ({
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      freshnessScore: row.freshnessScore,
      trustScore: row.trustScore,
      relevanceScore: row.relevanceScore,
      sourceType: "web",
    })),
  );

  const binaryConflicts: EvidenceConflictCandidate[] = contradictions.map((flag, index) => ({
    conflictId: `binary:${index + 1}`,
    conflictType: flag === "recency_conflict" ? "freshness_conflict" : "binary_conflict",
    evidenceIds: items.slice(0, 5).map((row) => row.id),
    sensitivity: flag === "recency_conflict" ? 0.75 : 0.62,
    notes: [flag],
  }));

  const numeric = detectNumericConflicts(items);
  const merged = [...binaryConflicts, ...numeric];
  return merged.slice(0, 10);
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

