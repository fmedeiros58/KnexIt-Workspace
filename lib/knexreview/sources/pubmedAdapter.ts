import type { GenericSearchStrategy, SearchResultRecord } from "../types";
import type { SourceAdapter } from "../sourceRegistry";

// TODO: integrar com E-utilities (NCBI). Precisaremos de API key (opcional) e rate-limit.
function buildBooleanString(strategy: GenericSearchStrategy): string {
  const groupStrings = strategy.groups.map((g) => {
    const terms = g.terms.map((t) => {
      const base = t.truncation ? `${t.term}*` : t.term;
      const field = t.field ? `[${t.field}]` : "";
      const prox = t.proximity ? `${t.proximity.operator}${t.proximity.distance}` : "";
      return `"${base}"${field}${prox}`;
    });
    return `(${terms.join(` ${g.joinWith} `)})`;
  });
  return groupStrings.join(` ${strategy.betweenGroupsOperator} `);
}

async function runQueryMock(query: string): Promise<SearchResultRecord[]> {
  // TODO: chamar API real (esearch/esummary) e normalizar.
  return [
    {
      id: `pubmed-1`,
      title: `Resultado PubMed mock para: ${query}`,
      abstract: "Resumo fictício retornado pelo adapter PubMed.",
      authors: ["Doe J"],
      year: 2024,
      doi: "10.0000/mock.pubmed",
      source: "pubmed",
      url: "https://pubmed.ncbi.nlm.nih.gov/",
    },
  ];
}

const pubmedAdapter: SourceAdapter = {
  id: "pubmed",
  displayName: "PubMed",
  isEnabled: () => true, // PubMed permite acesso sem API key para buscas simples
  supports: { booleanSearch: true, dateFilters: true, languageFilters: false },
  buildQuery: (strategy: GenericSearchStrategy) => buildBooleanString(strategy),
  runQuery: async (query) => runQueryMock(typeof query === "string" ? query : JSON.stringify(query)),
};

export default pubmedAdapter;

