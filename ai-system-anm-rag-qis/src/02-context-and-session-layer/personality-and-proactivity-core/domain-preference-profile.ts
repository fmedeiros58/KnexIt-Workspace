import { analyzeText, clamp01 } from "./personality-utils";

export interface DomainPreferenceProfileInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface DomainPreferenceProfileOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const DOMAIN_PATTERNS: Record<string, RegExp> = {
  technical: /\b(api|typescript|javascript|python|sql|docker|bug|debug|endpoint|infra)\b/g,
  research: /\b(fonte|fontes|source|sources|evidencia|evidence|estudo|study|paper)\b/g,
  writing: /\b(texto|rewrite|reescrever|copy|copywriting|roteiro|story|narrativa)\b/g,
  business: /\b(venda|sales|negocio|business|kpi|receita|margem|mercado|estrategia)\b/g,
  education: /\b(aprender|explicar|didatico|ensinar|exercicio|lesson|tutorial)\b/g,
};

function rankDomains(normalized: string) {
  const scores = Object.entries(DOMAIN_PATTERNS).map(([domain, pattern]) => ({
    domain,
    hits: (normalized.match(pattern) || []).length,
  }));
  scores.sort((a, b) => b.hits - a.hits);
  return scores;
}

export function domainPreferenceProfile(input: DomainPreferenceProfileInput = {}): DomainPreferenceProfileOutput {
  const analysis = analyzeText(input.text);
  const ranked = rankDomains(analysis.normalized);
  const dominant = ranked[0];
  const second = ranked[1];
  const totalHits = ranked.reduce((sum, item) => sum + item.hits, 0);
  const separation = dominant ? dominant.hits - (second?.hits || 0) : 0;

  const inferredScore = clamp01(
    (dominant?.hits ? Math.min(1, dominant.hits / 3) * 0.45 : 0.1) +
    (analysis.uniqueRatio * 0.2) +
    (Math.min(1, totalHits / 6) * 0.2) +
    (Math.min(1, separation / 2) * 0.15),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "domain-preference-profile",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `dominant=${dominant?.domain || "general"}; hits=${dominant?.hits || 0}; separation=${separation}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      dominantDomain: dominant?.hits ? dominant.domain : "general",
      domainScores: ranked,
      tokenCount: analysis.tokenCount,
      uniqueRatio: Number(analysis.uniqueRatio.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
