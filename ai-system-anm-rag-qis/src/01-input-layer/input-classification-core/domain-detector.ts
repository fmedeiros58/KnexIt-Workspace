export interface DomainDetectorInput {
  text: string;
}

export interface DomainDetectorOutput {
  domain: string;
  confidence: number;
  matchedKeywords: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const DOMAIN_KEYWORDS: Array<{ domain: string; keywords: string[] }> = [
  { domain: "software", keywords: ["typescript", "javascript", "node", "python", "api", "sql", "docker", "kubernetes", "backend", "frontend"] },
  { domain: "legal", keywords: ["lei", "juridico", "jurídico", "contrato", "direito", "clausula", "cláusula"] },
  { domain: "medical", keywords: ["medico", "médico", "saude", "saúde", "sintoma", "diagnostico", "diagnóstico", "remedio", "remédio"] },
  { domain: "finance", keywords: ["acao", "ação", "investimento", "imposto", "orcamento", "orçamento", "receita", "despesa"] },
  { domain: "education", keywords: ["estudo", "prova", "curso", "ensine", "exercício", "exercicio", "aula"] },
];

function normalizeTerm(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function domainDetector(input: DomainDetectorInput): DomainDetectorOutput {
  const normalizedText = normalizeTerm(input.text || "");
  let bestDomain = "general";
  let bestMatches: string[] = [];

  for (const item of DOMAIN_KEYWORDS) {
    const matches = item.keywords.filter((keyword) => normalizedText.includes(normalizeTerm(keyword)));
    if (matches.length > bestMatches.length) {
      bestDomain = item.domain;
      bestMatches = matches;
    }
  }

  const confidence = bestMatches.length
    ? Math.min(0.95, 0.55 + (bestMatches.length * 0.11))
    : 0.42;

  return {
    domain: bestDomain,
    confidence: Number(confidence.toFixed(4)),
    matchedKeywords: bestMatches,
    ok: true,
    component: "domain-detector",
    score: Number(confidence.toFixed(4)),
    detail: bestDomain,
    context: {
      keywordMatches: bestMatches,
    },
  };
}
