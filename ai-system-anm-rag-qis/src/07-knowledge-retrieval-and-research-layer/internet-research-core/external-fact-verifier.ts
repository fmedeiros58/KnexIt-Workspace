import type { KnowledgeCandidate } from "../knowledge-types";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function verifyExternalFacts(results: KnowledgeCandidate[]): { verified: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!results.length) {
    issues.push("no_external_results");
    return { verified: false, issues };
  }

  const domains = new Set(results.map((item) => extractDomain(item.url)).filter(Boolean));
  const lowTrustCount = results.filter((item) => item.trustScore < 0.45).length;
  const highTrustCount = results.filter((item) => item.trustScore >= 0.72).length;
  const staleCount = results.filter((item) => item.freshnessScore < 0.45).length;

  if (domains.size < 2) issues.push("low_domain_diversity");
  if (lowTrustCount >= 2) issues.push("low_trust_external_sources");
  if (!highTrustCount) issues.push("no_high_trust_source");
  if (staleCount >= Math.ceil(results.length * 0.7)) issues.push("mostly_stale_sources");

  return {
    verified: issues.length === 0,
    issues,
  };
}
