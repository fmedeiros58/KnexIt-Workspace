import type { GenericSearchStrategy, SearchResultRecord } from "../types";
import type { SourceAdapter } from "../sourceRegistry";

function buildQuery(strategy: GenericSearchStrategy): string {
  // CrossRef aceita query simples; aqui usamos uma string concatenada dos grupos.
  const terms = strategy.groups.map((g) => g.terms.map((t) => t.term).join(" ")).join(" ");
  return terms;
}

async function runQueryMock(query: string): Promise<SearchResultRecord[]> {
  // TODO: integrar com https://api.crossref.org/works?query=
  return [
    {
      id: `crossref-1`,
      title: `CrossRef mock: ${query}`,
      abstract: "Registro fictício da CrossRef.",
      year: 2023,
      source: "crossref",
      doi: "10.0000/mock.crossref",
      url: "https://api.crossref.org",
    },
  ];
}

const crossrefAdapter: SourceAdapter = {
  id: "crossref",
  displayName: "CrossRef",
  isEnabled: () => true,
  supports: { booleanSearch: true, dateFilters: true, languageFilters: false },
  buildQuery,
  runQuery: async (q) => runQueryMock(typeof q === "string" ? q : JSON.stringify(q)),
};

export default crossrefAdapter;

