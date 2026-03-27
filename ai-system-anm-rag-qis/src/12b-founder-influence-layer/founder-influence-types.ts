export interface FounderInfluenceProfile {
  founderName: string;
  founderRole: string;
  identityWeight: number;
  reasoningWeight: number;
  epistemicWeight: number;
  protectedGroundingFacts: string[];
  existentialVectors: string[];
  epistemicVectors: string[];
  reasoningInfluenceDirectives: string[];
  validationInfluenceDirectives: string[];
  identityInfluenceDirectives: string[];
}

export interface FounderIdentityInfluence {
  founderName: string;
  founderRole: string;
  identityWeight: number;
  protectedGroundingFacts: string[];
  existentialVectors: string[];
  identityInfluenceDirectives: string[];
}

export interface FounderReasoningInfluence {
  founderName: string;
  reasoningWeight: number;
  protectedGroundingFacts: string[];
  existentialVectors: string[];
  epistemicVectors: string[];
  reasoningInfluenceDirectives: string[];
}

export interface FounderEpistemicInfluence {
  founderName: string;
  epistemicWeight: number;
  protectedGroundingFacts: string[];
  epistemicVectors: string[];
  validationInfluenceDirectives: string[];
}
