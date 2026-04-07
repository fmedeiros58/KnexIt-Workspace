/**
 * Responsabilidade do arquivo:
 * - Consolidar a influencia do fundador (identidade, raciocinio e epistemica).
 * - Publicar a influencia no estado compartilhado para consumo das camadas seguintes.
 * - Registrar trace explicito para auditabilidade do pipeline descendente.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { buildFounderEpistemicInfluence } from "./founder-epistemic-bridge";
import { buildFounderIdentityInfluence } from "./founder-identity-bridge";
import { buildFounderReasoningInfluence } from "./founder-reasoning-bridge";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export async function runFounderInfluenceLayer(state: ProcessingState): Promise<ProcessingState> {
  const identity = buildFounderIdentityInfluence();
  const reasoning = buildFounderReasoningInfluence();
  const epistemic = buildFounderEpistemicInfluence();
  const previous = state.executionArtifacts.founderInfluence;

  state.executionArtifacts = state.executionArtifacts || {
    knowledge: {
      cache: {},
      lastQuerySignature: "",
      lastUsedCache: false,
    },
  };

  state.executionArtifacts.founderInfluence = {
    founderName: identity.founderName,
    founderRole: identity.founderRole,
    identityWeight: identity.identityWeight,
    reasoningWeight: reasoning.reasoningWeight,
    epistemicWeight: epistemic.epistemicWeight,
    identityInfluenceDirectives: unique([
      ...(previous?.identityInfluenceDirectives || []),
      ...identity.identityInfluenceDirectives,
    ]),
    reasoningInfluenceDirectives: unique([
      ...(previous?.reasoningInfluenceDirectives || []),
      ...reasoning.reasoningInfluenceDirectives,
    ]),
    validationInfluenceDirectives: unique([
      ...(previous?.validationInfluenceDirectives || []),
      ...epistemic.validationInfluenceDirectives,
    ]),
    existentialVectors: unique([
      ...(previous?.existentialVectors || []),
      ...identity.existentialVectors,
      ...reasoning.existentialVectors,
    ]),
    epistemicVectors: unique([
      ...(previous?.epistemicVectors || []),
      ...reasoning.epistemicVectors,
      ...epistemic.epistemicVectors,
    ]),
    protectedGroundingFacts: unique([
      ...(previous?.protectedGroundingFacts || []),
      ...identity.protectedGroundingFacts,
      ...reasoning.protectedGroundingFacts,
      ...epistemic.protectedGroundingFacts,
    ]),
  };

  state.trace.push(
    makeTraceEvent({
      layer: "founder-influence",
      action: "founder_influence_applied",
      route: state.executionPlan.selectedRoute,
      latencyMs: 0,
      detail:
        `founder=${identity.founderName}; role=${identity.founderRole}; ` +
        `weights=${identity.identityWeight.toFixed(2)}/${reasoning.reasoningWeight.toFixed(2)}/${epistemic.epistemicWeight.toFixed(2)}; ` +
        `identityDirectives=${identity.identityInfluenceDirectives.length}; reasoningDirectives=${reasoning.reasoningInfluenceDirectives.length}; validationDirectives=${epistemic.validationInfluenceDirectives.length}`,
    }),
  );

  return state;
}
