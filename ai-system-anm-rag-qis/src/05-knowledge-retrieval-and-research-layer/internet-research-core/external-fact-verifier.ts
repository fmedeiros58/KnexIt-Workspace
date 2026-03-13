import type { KnowledgeCandidate } from "../knowledge-types";

export function verifyExternalFacts(results: KnowledgeCandidate[]): { verified: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!results.length) issues.push("no_external_results");
  const lowTrustCount = results.filter((item) => item.trustScore < 0.45).length;
  if (lowTrustCount >= 2) issues.push("low_trust_external_sources");
  return {
    verified: issues.length === 0,
    issues,
  };
}
