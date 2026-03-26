/**
 * Responsabilidade do arquivo:
 * - Orquestrar classificacao de claims, boundaries, stance e incerteza.
 * - Consolidar auditoria epistemica para a camada 13 sem quebrar o estado atual.
 * - Produzir payload reutilizavel por validacao e apresentacao.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { classifyEpistemicClaims } from "./epistemic-claim-classifier";
import { detectEpistemicBoundaries } from "./epistemic-boundary-detector";
import { analyzeEvidenceStance } from "./evidence-stance-analyzer";
import { buildUncertaintySignals } from "./uncertainty-signaler";
import { scoreEpistemicConfidence } from "./epistemic-confidence-scorer";

export interface EpistemicIntegrationAudit {
  claims: ReturnType<typeof classifyEpistemicClaims>;
  boundaries: ReturnType<typeof detectEpistemicBoundaries>;
  stances: ReturnType<typeof analyzeEvidenceStance>;
  uncertainty: ReturnType<typeof buildUncertaintySignals>;
  confidence: number;
}

export function runEpistemicIntegrationOrchestrator(state: ProcessingState): EpistemicIntegrationAudit {
  const textBase = state.structuredResponse || state.draftResponse.text || state.collapsedTruth.summary || "";
  const claims = classifyEpistemicClaims(textBase, 20);
  const boundaries = detectEpistemicBoundaries(claims, state.retrievedSources.length);
  const stances = analyzeEvidenceStance(claims, state.retrievedEvidence);
  const uncertainty = buildUncertaintySignals({
    overclaimRisk: boundaries.overclaimRisk,
    stanceRows: stances,
    extrapolationFlags: boundaries.extrapolationFlags,
  });
  const confidence = scoreEpistemicConfidence({
    claims,
    stanceRows: stances,
    overclaimRisk: boundaries.overclaimRisk,
  });

  return { claims, boundaries, stances, uncertainty, confidence };
}

