/**
 * Responsabilidade do arquivo:
 * - Detectar convergencia interfontes em torno de sinais semelhantes.
 * - Entregar clusters de apoio para consumo epistêmico posterior.
 * - Evitar consolidacao cega de itens isolados sem suporte cruzado.
 */
import { textNormalizationService } from "../../shared/text-processing/text-normalization.service";
import type { EvidenceConvergenceCluster, EvidenceItem } from "./iterative-acquisition-types";

function convergenceKey(item: EvidenceItem): string {
  const title = textNormalizationService.fingerprint(item.title || "");
  const snippet = textNormalizationService.fingerprint(item.snippet || "");
  const head = snippet.split(" ").slice(0, 8).join(" ");
  return `${title}|${head}`.slice(0, 180);
}

export function analyzeEvidenceConvergence(items: EvidenceItem[]): EvidenceConvergenceCluster[] {
  const map = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const key = convergenceKey(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const clusters: EvidenceConvergenceCluster[] = [];
  for (const [key, rows] of map.entries()) {
    if (rows.length < 2) continue;
    clusters.push({
      clusterId: `cluster:${Math.abs(hashCode(key))}`,
      signal: rows[0]?.title || "signal",
      supportCount: rows.length,
      evidenceIds: rows.map((row) => row.id),
    });
  }

  return clusters.sort((a, b) => b.supportCount - a.supportCount).slice(0, 8);
}

function hashCode(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

