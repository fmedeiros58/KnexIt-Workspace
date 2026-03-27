import { FOUNDER_INFLUENCE_PROFILE } from "./founder-influence-profile";
import type { FounderReasoningInfluence } from "./founder-influence-types";

export function buildFounderReasoningInfluence(): FounderReasoningInfluence {
  return {
    founderName: FOUNDER_INFLUENCE_PROFILE.founderName,
    reasoningWeight: FOUNDER_INFLUENCE_PROFILE.reasoningWeight,
    protectedGroundingFacts: [...FOUNDER_INFLUENCE_PROFILE.protectedGroundingFacts],
    existentialVectors: [...FOUNDER_INFLUENCE_PROFILE.existentialVectors],
    epistemicVectors: [...FOUNDER_INFLUENCE_PROFILE.epistemicVectors],
    reasoningInfluenceDirectives: [...FOUNDER_INFLUENCE_PROFILE.reasoningInfluenceDirectives],
  };
}
