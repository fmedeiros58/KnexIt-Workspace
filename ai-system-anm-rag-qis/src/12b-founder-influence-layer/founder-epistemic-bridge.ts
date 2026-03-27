import { FOUNDER_INFLUENCE_PROFILE } from "./founder-influence-profile";
import type { FounderEpistemicInfluence } from "./founder-influence-types";

export function buildFounderEpistemicInfluence(): FounderEpistemicInfluence {
  return {
    founderName: FOUNDER_INFLUENCE_PROFILE.founderName,
    epistemicWeight: FOUNDER_INFLUENCE_PROFILE.epistemicWeight,
    protectedGroundingFacts: [...FOUNDER_INFLUENCE_PROFILE.protectedGroundingFacts],
    epistemicVectors: [...FOUNDER_INFLUENCE_PROFILE.epistemicVectors],
    validationInfluenceDirectives: [...FOUNDER_INFLUENCE_PROFILE.validationInfluenceDirectives],
  };
}
