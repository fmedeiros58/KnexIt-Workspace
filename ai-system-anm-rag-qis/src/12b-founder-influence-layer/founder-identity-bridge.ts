import { FOUNDER_INFLUENCE_PROFILE } from "./founder-influence-profile";
import type { FounderIdentityInfluence } from "./founder-influence-types";

export function buildFounderIdentityInfluence(): FounderIdentityInfluence {
  return {
    founderName: FOUNDER_INFLUENCE_PROFILE.founderName,
    founderRole: FOUNDER_INFLUENCE_PROFILE.founderRole,
    identityWeight: FOUNDER_INFLUENCE_PROFILE.identityWeight,
    protectedGroundingFacts: [...FOUNDER_INFLUENCE_PROFILE.protectedGroundingFacts],
    existentialVectors: [...FOUNDER_INFLUENCE_PROFILE.existentialVectors],
    identityInfluenceDirectives: [...FOUNDER_INFLUENCE_PROFILE.identityInfluenceDirectives],
  };
}
