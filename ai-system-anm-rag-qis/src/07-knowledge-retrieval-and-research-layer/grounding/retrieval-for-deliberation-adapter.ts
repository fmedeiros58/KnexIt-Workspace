/**
 * Responsabilidade do arquivo:
 * - Orquestrar retrieval semantico para deliberacao usando stack ja existente.
 * - Consolidar pacote unico de grounding para modulos 12/13/14/17.
 * - Evitar recriacao de retrieval e apenas adaptar o consumo inteligente da evidencia.
 */
import type { DeliberativeGroundingInput, GroundedEvidencePacket } from "./grounded-evidence-packet";
import { retrieveSupportingEvidence } from "./supporting-evidence-retriever";
import { retrieveContrastingEvidence } from "./contrasting-evidence-retriever";
import { retrieveEvidenceGaps } from "./gap-evidence-retriever";
import { retrieveDialogicContext } from "./dialogic-context-retriever";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function buildDeliberativeGroundingPacket(input: DeliberativeGroundingInput): GroundedEvidencePacket {
  const supporting = retrieveSupportingEvidence(input, 8);
  const contrasting = retrieveContrastingEvidence(input, 6);
  const gaps = retrieveEvidenceGaps(input);
  const dialogicContext = retrieveDialogicContext(input, 6);

  const supportMass = supporting.reduce((sum, row) => sum + row.score, 0);
  const contrastMass = contrasting.reduce((sum, row) => sum + row.score, 0);
  const gapPenalty = gaps.reduce((sum, row) => sum + (row.severity === "high" ? 0.24 : row.severity === "medium" ? 0.14 : 0.08), 0);
  const confidence = clamp01((supportMass * 0.18) + (dialogicContext.length * 0.04) - (gapPenalty * 0.20) - (contrastMass * 0.06));
  const conflictLevel = clamp01((contrastMass * 0.14) + (gaps.length * 0.10));

  const summary = [
    `supporting=${supporting.length}`,
    `contrasting=${contrasting.length}`,
    `gaps=${gaps.length}`,
    `dialogic=${dialogicContext.length}`,
    `confidence=${confidence.toFixed(2)}`,
    `conflict=${conflictLevel.toFixed(2)}`,
  ].join("; ");

  return {
    query: input.query,
    supporting,
    contrasting,
    gaps,
    dialogicContext,
    confidence,
    conflictLevel,
    summary,
    createdAt: new Date().toISOString(),
  };
}

