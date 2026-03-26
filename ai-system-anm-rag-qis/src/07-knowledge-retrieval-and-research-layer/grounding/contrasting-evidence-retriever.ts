/**
 * Responsabilidade do arquivo:
 * - Recuperar evidencias com stance de contraste/contradicao.
 * - Usar sinais existentes (contradiction flags, hipoteses concorrentes e snippets conflitantes).
 * - Entregar contraste controlado para deliberacao sem criar oposicao artificial.
 */
import type { DeliberativeGroundingInput, GroundedEvidenceItem } from "./grounded-evidence-packet";
import { dedupeGroundedItems, normalizeGroundingText, scoreLexicalAffinity } from "./grounding-normalizer";

const CONTRAST_CUES = /\b(mas|porem|contudo|entretanto|no entanto|por outro lado|contrario|inconsistente|conflito)\b/i;

function isGroundedEvidenceItem(item: GroundedEvidenceItem | null): item is GroundedEvidenceItem {
  return item !== null;
}

export function retrieveContrastingEvidence(input: DeliberativeGroundingInput, maxItems = 6): GroundedEvidenceItem[] {
  const fromEvidence = input.retrievedEvidence
    .map<GroundedEvidenceItem | null>((evidence, index) => {
      const hasCue = CONTRAST_CUES.test(evidence);
      const affinity = scoreLexicalAffinity(input.query, evidence);
      if (!hasCue && affinity < 0.2) return null;
      return {
        id: `contrast:evidence:${index + 1}`,
        stance: "contrasting" as const,
        sourceType: "retrieved_evidence" as const,
        title: `contrasting-evidence-${index + 1}`,
        snippet: normalizeGroundingText(evidence),
        url: "memory://retrieved_evidence",
        score: Math.max(0.2, affinity),
        tags: ["contrast", hasCue ? "cue" : "affinity"],
      };
    })
    .filter(isGroundedEvidenceItem);

  const fromHypothesisConflict = input.hypothesisSet
    .filter((hypothesis) => hypothesis.contradictorySources.length > 0)
    .map((hypothesis, index) => ({
      id: `contrast:hypothesis:${index + 1}`,
      stance: "contrasting" as const,
      sourceType: "retrieved_evidence" as const,
      title: `hypothesis-conflict-${hypothesis.id}`,
      snippet: normalizeGroundingText(
        `Hipotese concorrente detectada: ${hypothesis.claim}. Fontes contraditorias: ${hypothesis.contradictorySources.join(", ")}`,
      ),
      url: "memory://hypothesis_conflict",
      score: 0.42,
      tags: ["hypothesis", "conflict"],
    }));

  return dedupeGroundedItems([...fromEvidence, ...fromHypothesisConflict])
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);
}
