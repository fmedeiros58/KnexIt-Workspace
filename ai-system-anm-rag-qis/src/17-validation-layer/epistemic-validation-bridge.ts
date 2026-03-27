/**
 * Responsabilidade do arquivo:
 * - Integrar validadores epistemicos especializados ao fluxo da camada 17.
 * - Reaproveitar claims/hipoteses/evidencias sem recriar fundacoes existentes.
 * - Atualizar ProcessingState com veredito auditavel e modular.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { classifyEpistemicClaims } from "../13-epistemic-integration-layer/epistemic-claim-classifier";
import { validateClaimsAgainstEvidence } from "./claim-to-evidence-validator";
import { detectEpistemicContradictions } from "./contradiction-detector";
import { estimateSupportCoverage } from "./support-coverage-estimator";
import { validateHypothesisCompetition } from "./hypothesis-competition-validator";
import { buildEpistemicValidationVerdict } from "./validation-verdict-builder";

export function runEpistemicValidationBridge(state: ProcessingState) {
  const sourceText = state.structuredResponse || state.draftResponse.text || state.collapsedTruth.summary || "";
  const claims = classifyEpistemicClaims(sourceText, 20);
  const claimValidation = validateClaimsAgainstEvidence(claims, state.retrievedEvidence);
  const coverage = estimateSupportCoverage(claimValidation);
  const contradiction = detectEpistemicContradictions(claims, state.retrievedEvidence);
  const hypothesisCompetition = validateHypothesisCompetition(state);
  const unsupportedClaims = claimValidation.filter((row) => !row.supported).length;
  const verdict = buildEpistemicValidationVerdict({
    coverage: coverage.coverage,
    contradictionCount: contradiction.issues.length,
    hypothesisCompetitionOk: hypothesisCompetition.ok,
    unsupportedClaims,
  });

  state.executionArtifacts = {
    ...state.executionArtifacts,
    epistemicValidation: {
      claimCount: claims.length,
      coverage: coverage.coverage,
      contradictionIssues: contradiction.issues,
      hypothesisCompetition: hypothesisCompetition,
      verdict,
    },
  };

  return {
    claims,
    claimValidation,
    coverage,
    contradiction,
    hypothesisCompetition,
    verdict,
  };
}

